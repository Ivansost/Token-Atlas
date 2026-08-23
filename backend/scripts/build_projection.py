"""M3 -- give every token a fixed place in 3D. Run once, offline, commit the result.

The model stores each of its tokens as 896 numbers -- its internal sense of what that token means.
Tokens used in similar ways get similar numbers. This projects that 896-D space down to 3 so a
word can have a position you can draw, and so that position means something.

    python backend/scripts/build_projection.py           # build and save
    python backend/scripts/build_projection.py --check    # build, save, score, inspect neighbours

WHY UMAP AND NOT PCA -- measured at M3, not assumed:

    method                     neighbourhood preservation
    random chance                                    1.0%
    PCA-3  (the original plan)                       7.2%
    UMAP-3                                          67.8%

"Neighbourhood preservation" = of a token's 10 nearest neighbours in the model's own 896-D space,
what fraction stay within the nearest 1% of the 3-D scene. PCA scored 7%, which means node
position would have been very nearly decorative -- and the UI legend claims position is semantic.
Three linear directions cannot carry 896 dimensions of structure; PCA's three components hold only
4.6% of the variance. That is a property of the data, not a tuning problem: normalising, whitening,
column-standardising and dropping PC1 all landed within a point of each other.

The plan originally rejected UMAP as "randomly initialised, no stable reusable projection". That
objection is about RE-FITTING. We fit once, offline, with a fixed seed, and commit the coordinates,
so the projection is exactly as frozen as PCA would have been -- and UMAP never runs on the server,
so it costs the deployed container nothing.
"""

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.model import MODEL_ID, get_model  # noqa: E402

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
COORDS_PATH = DATA_DIR / "vocab_umap_3d.npy"
META_PATH = DATA_DIR / "vocab_umap_3d.json"

# The browser cannot parse .npy. The same coordinates are also written as a raw little-endian
# float32 dump, which JS reads with zero parsing:
#     new Float32Array(await (await fetch(url)).arrayBuffer())
# It is committed so the frontend deploy needs no Python step.
WEB_COORDS_PATH = Path(__file__).resolve().parents[2] / "frontend" / "public" / "data" / "vocab_xyz.bin"
WEB_TOKENS_PATH = WEB_COORDS_PATH.parent / "vocab_tokens.json"

N_NEIGHBORS = 15         # scored best of the values tried at M3
MIN_DIST = 0.1
TARGET_RADIUS = 60.0     # scene units
CLIP_PERCENTILE = 99.5   # ignore outliers when scaling, or they squash everything else

PROBES = [" king", " Paris", " dog", " however", " seven"]


def embeddings() -> tuple[np.ndarray, int]:
    """L2-normalised input embeddings for the real (decodable) tokens only.

    The tokenizer knows fewer tokens than the matrix has rows -- the extra rows are reserved
    padding with no text, which would scatter meaningless points through the scene.

    Normalised because cosine similarity is the metric that produces sensible neighbours; raw
    embedding norms track token frequency more than meaning.
    """
    tok, model = get_model()
    emb = model.get_input_embeddings().weight.detach().float().numpy()
    limit = len(tok)
    real = emb[:limit]
    return real / (np.linalg.norm(real, axis=1, keepdims=True) + 1e-9), limit


def preservation(hi: np.ndarray, coords: np.ndarray, n_probes: int = 150, k: int = 10) -> float:
    """THE GATE. Fraction of each token's 896-D neighbours that stay close in 3-D. Chance = 1%."""
    n = hi.shape[0]
    top_pct = max(1, n // 100)
    rng = np.random.default_rng(0)
    probes = rng.choice(min(20000, n), size=n_probes, replace=False)

    hits = 0
    for p in probes:
        true_neighbours = np.argsort(-(hi @ hi[p]))[1 : k + 1]
        d = np.linalg.norm(coords - coords[p], axis=1)
        rank = np.empty(n, dtype=np.int64)
        rank[np.argsort(d)] = np.arange(n)
        hits += int((rank[true_neighbours] < top_pct).sum())
    return hits / (n_probes * k)


def build() -> tuple[np.ndarray, dict]:
    import umap  # imported here so the server never needs it

    hi, limit = embeddings()
    print(f"projecting {limit:,} tokens from {hi.shape[1]} dimensions to 3 ...")

    t0 = time.perf_counter()
    coords = np.asarray(
        umap.UMAP(
            n_components=3,
            n_neighbors=N_NEIGHBORS,
            min_dist=MIN_DIST,
            metric="cosine",
            random_state=0,          # deterministic; costs parallelism, worth it
            verbose=True,
        ).fit_transform(hi),
        dtype=np.float32,
    )
    fit_s = time.perf_counter() - t0
    print(f"fitted in {fit_s / 60:.1f} min")

    # Centre on the median and scale UNIFORMLY, preserving the shape of the cloud.
    coords -= np.median(coords, axis=0)
    radius = float(np.percentile(np.linalg.norm(coords, axis=1), CLIP_PERCENTILE))
    coords *= TARGET_RADIUS / radius

    meta = {
        "model": MODEL_ID,
        "method": "UMAP",
        "tokens": int(limit),
        "n_neighbors": N_NEIGHBORS,
        "min_dist": MIN_DIST,
        "metric": "cosine",
        "random_state": 0,
        "fit_seconds": round(fit_s, 1),
        "target_radius": TARGET_RADIUS,
        "scaling": "uniform, centred on median, scaled at the 99.5th percentile radius",
    }
    return coords, meta


def show_neighbours(coords: np.ndarray) -> None:
    """Both spaces, side by side. If 896-D looks good and 3-D looks random, the projection lost it."""
    tok, _ = get_model()
    hi, _ = embeddings()

    for probe in PROBES:
        ids = tok(probe, add_special_tokens=False).input_ids
        if len(ids) != 1:
            print(f"\n{probe!r} is {len(ids)} tokens, skipping")
            continue
        i = ids[0]

        hi_best = np.argsort(-(hi @ hi[i]))[1:9]
        lo_best = np.argsort(np.linalg.norm(coords - coords[i], axis=1))[1:9]
        fmt = lambda idx: "  ".join(tok.decode([j]).replace(" ", "·") for j in idx)  # noqa: E731

        print(f"\n{probe!r} (id {i})")
        print(f"   896-D neighbours : {fmt(hi_best)}")
        print(f"     3-D neighbours : {fmt(lo_best)}")


def export_for_web(coords: np.ndarray) -> None:
    """Write the coordinates, and the token text, in forms the browser can use directly."""
    WEB_COORDS_PATH.parent.mkdir(parents=True, exist_ok=True)
    WEB_COORDS_PATH.write_bytes(np.ascontiguousarray(coords, dtype="<f4").tobytes())
    print(f"exported {WEB_COORDS_PATH.name:<18} {coords.shape[0]:,} points  "
          f"{WEB_COORDS_PATH.stat().st_size / 1e6:.2f} MB")

    # The text of every token, indexed identically to the coordinates. Without this the browser
    # can draw the vocabulary but cannot say what any of it IS -- clicking a point would return a
    # number. A point you cannot interrogate is decoration, so this is what makes the field
    # inspectable rather than atmospheric.
    tok, _ = get_model()
    tokens = [tok.decode([i]) for i in range(coords.shape[0])]
    WEB_TOKENS_PATH.write_text(json.dumps(tokens, ensure_ascii=False), encoding="utf-8")
    print(f"exported {WEB_TOKENS_PATH.name:<18} {len(tokens):,} strings "
          f"{WEB_TOKENS_PATH.stat().st_size / 1e6:.2f} MB")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--check", action="store_true", help="score the projection and show neighbours")
    p.add_argument("--export-only", action="store_true",
                   help="skip the 2-minute fit; just re-export the existing .npy for the browser")
    args = p.parse_args()

    if args.export_only:
        export_for_web(np.load(COORDS_PATH))
        return

    coords, meta = build()

    if args.check:
        hi, _ = embeddings()
        score = preservation(hi, coords)
        meta["neighbourhood_preservation"] = round(score, 4)
        print(f"\nGATE: neighbourhood preservation {score:.1%}  (random chance 1.0%, PCA scored 7.2%)")

    DATA_DIR.mkdir(exist_ok=True)
    np.save(COORDS_PATH, coords)
    META_PATH.write_text(json.dumps(meta, indent=2) + "\n")
    export_for_web(coords)

    span = coords.max(axis=0) - coords.min(axis=0)
    print(f"\nsaved {COORDS_PATH}  {coords.shape}  {COORDS_PATH.stat().st_size / 1e6:.2f} MB")
    print(f"bounding box span    x {span[0]:.1f}  y {span[1]:.1f}  z {span[2]:.1f}")

    if args.check:
        show_neighbours(coords)


if __name__ == "__main__":
    main()

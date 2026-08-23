"""M4 -- the atlas layers: which region each token belongs to, and which tokens are neighbours.

Run once, offline, commit the result. Two artifacts, both derived from the model's own embeddings:

  vocab_clusters.bin   one uint8 region id per token, parallel to vocab_xyz.bin
  vocab_edges.bin      uint32 index pairs into the same vertex list
  vocab_atlas.json     region labels, sizes, and the tokens that define each one

WHY THIS EXISTS, honestly stated: the visual reference is a dense multi-coloured network atlas.
We cannot colour by script or character class -- that was measured and the vocabulary does not
cluster that way (CJK spreads at 0.98x the whole vocabulary). So instead of inventing a category,
this finds the regions the projection actually has, and labels each one with the tokens nearest
its centre. Every colour on screen then corresponds to a region somebody can inspect and argue
with, which is the only kind of colour this project is allowed to use.

The edges are not decorative either. UMAP builds a k-nearest-neighbour graph over the embeddings
and lays the points out to respect it; this exports that same graph, computed with the same
library UMAP uses (pynndescent) on the same normalised embeddings with the same metric. A line
between two tokens means the model represents them similarly. It is the structure the picture is
already made of, drawn instead of implied.

    python backend/scripts/build_atlas.py
    python backend/scripts/build_atlas.py --clusters 14 --neighbors 3
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.cluster import MiniBatchKMeans

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.model import get_model  # noqa: E402

BACKEND = Path(__file__).resolve().parents[1]
WEB_DATA = BACKEND.parent / "frontend" / "public" / "data"
COORDS_PATH = BACKEND / "data" / "vocab_umap_3d.npy"

CLUSTERS_OUT = WEB_DATA / "vocab_clusters.bin"
EDGES_OUT = WEB_DATA / "vocab_edges.bin"
ATLAS_OUT = WEB_DATA / "vocab_atlas.json"


def embeddings() -> np.ndarray:
    """L2-normalised input embeddings for the decodable tokens -- the same input the projection used."""
    tok, model = get_model()
    emb = model.get_input_embeddings().weight.detach().float().numpy()[: len(tok)]
    return emb / (np.linalg.norm(emb, axis=1, keepdims=True) + 1e-9)


def build_edges(hi: np.ndarray, k: int) -> np.ndarray:
    """The k-nearest-neighbour graph, deduplicated to undirected pairs.

    pynndescent is what UMAP itself uses, so this is the same approximate graph the layout was
    built to respect -- not a second opinion computed a different way.
    """
    from pynndescent import NNDescent

    print(f"building the {k}-nearest-neighbour graph over {hi.shape[0]:,} tokens ...")
    index = NNDescent(hi, metric="cosine", n_neighbors=k + 1, random_state=0, verbose=True)
    neighbours, _ = index.neighbor_graph

    pairs = set()
    for i, row in enumerate(neighbours):
        for j in row[1:]:                      # column 0 is the token itself
            j = int(j)
            if i != j:
                pairs.add((i, j) if i < j else (j, i))

    edges = np.fromiter((v for pair in sorted(pairs) for v in pair), dtype=np.uint32)
    print(f"{len(pairs):,} undirected edges")
    return edges


def build_clusters(coords: np.ndarray, k: int, tok) -> tuple[np.ndarray, list[dict]]:
    """Regions of the projected space, each labelled by the tokens nearest its centre."""
    print(f"finding {k} regions ...")
    km = MiniBatchKMeans(n_clusters=k, random_state=0, n_init=10, batch_size=4096)
    labels = km.fit_predict(coords).astype(np.uint8)

    regions = []
    for cid in range(k):
        members = np.where(labels == cid)[0]
        centre = km.cluster_centers_[cid]
        nearest = members[np.argsort(np.linalg.norm(coords[members] - centre, axis=1))[:8]]
        examples = [tok.decode([int(i)]).replace(" ", "·") for i in nearest]
        regions.append({
            "id": cid,
            "count": int(members.size),
            "centre": [round(float(v), 2) for v in centre],
            "examples": examples,
        })
        print(f"  region {cid:>2}  {members.size:>7,} tokens   {'  '.join(examples[:6])}")
    return labels, regions


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--clusters", type=int, default=28)
    p.add_argument("--neighbors", type=int, default=3)
    p.add_argument("--skip-edges", action="store_true",
                   help="reuse the existing edge file; the kNN graph is the slow half")
    args = p.parse_args()

    tok, _ = get_model()
    coords = np.load(COORDS_PATH)

    labels, regions = build_clusters(coords, args.clusters, tok)

    if args.skip_edges and EDGES_OUT.exists():
        edges = np.frombuffer(EDGES_OUT.read_bytes(), dtype="<u4")
        print(f"reusing {EDGES_OUT.name}: {edges.size // 2:,} edges")
    else:
        hi = embeddings()
        assert hi.shape[0] == coords.shape[0], "embeddings and coordinates disagree on token count"
        edges = build_edges(hi, args.neighbors)

    WEB_DATA.mkdir(parents=True, exist_ok=True)
    CLUSTERS_OUT.write_bytes(labels.tobytes())
    EDGES_OUT.write_bytes(np.ascontiguousarray(edges, dtype="<u4").tobytes())
    ATLAS_OUT.write_text(json.dumps({
        "tokens": int(coords.shape[0]),
        "clusters": args.clusters,
        "neighbors": args.neighbors,
        "edges": int(edges.size // 2),
        "regions": regions,
    }, ensure_ascii=False, indent=2) + "\n")

    for path in (CLUSTERS_OUT, EDGES_OUT, ATLAS_OUT):
        print(f"saved {path.name:<22} {path.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()

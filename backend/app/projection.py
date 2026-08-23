"""Token id -> fixed 3D coordinate.

Reads the artifact built offline by `scripts/build_projection.py`. Loaded once, held in memory,
never recomputed: the whole point is that a token occupies the same place in every run, in every
step, and while scrubbing backwards.

If the artifact is missing the module stays silent and every lookup returns None, so `pos3d` is
simply null in the events and the rest of the system carries on. That keeps the backend runnable
before M3 has been built, and on a checkout where the file was not committed.
"""

import sys
from pathlib import Path
from typing import Optional

import numpy as np

COORDS_PATH = Path(__file__).resolve().parents[1] / "data" / "vocab_umap_3d.npy"

_coords: Optional[np.ndarray] = None
_loaded = False


def _load() -> Optional[np.ndarray]:
    global _coords, _loaded
    if not _loaded:
        _loaded = True
        if COORDS_PATH.exists():
            _coords = np.load(COORDS_PATH)
            print(f"[projection] {COORDS_PATH.name}: {_coords.shape[0]:,} tokens", file=sys.stderr)
        else:
            print(f"[projection] {COORDS_PATH.name} not found -- pos3d will be null. "
                  f"Run scripts/build_projection.py", file=sys.stderr)
    return _coords


def lookup(token_id: int) -> Optional[list[float]]:
    """Fixed [x, y, z] for a token, or None if unknown."""
    coords = _load()
    if coords is None or token_id >= coords.shape[0]:
        return None
    return [round(float(v), 3) for v in coords[token_id]]


def is_available() -> bool:
    return _load() is not None

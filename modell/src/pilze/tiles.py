"""The geometry of the XYZ tile grid, and the coding of a value tile.

A tile carries the value, not the colour. One byte per point instead of four,
and the browser applies the colour ramp. That is the smaller half of the
saving. The larger half is that a viewport asks for the tiles it shows, not
for the whole country: an overview of Germany costs six tiles instead of a
1.4 MB image, and a close view costs eight.

Byte 0 means no data. Bytes 1 to 255 carry the value relative to the highest
cell of this species, so the full range stays in use even for a species whose
best cell reaches 0.20. The absolute value comes back as (byte - 1) / 254 *
top, with top in the manifest.
"""
from __future__ import annotations

import math

import numpy as np

# Half the width of the web mercator world, in metres.
RAND = 20037508.342789244
KACHEL = 256
STUFEN = 254.0


def to_byte(share: np.ndarray) -> np.ndarray:
    """Code a field of 0 to 1 as bytes. A value that is not finite gets 0."""
    field = np.asarray(share, dtype="float32")
    code = np.rint(np.clip(field, 0.0, 1.0) * STUFEN) + 1.0
    return np.where(np.isfinite(field), code, 0.0).astype("uint8")


def from_byte(code: np.ndarray) -> np.ndarray:
    """Read bytes back as a field of 0 to 1. Byte 0 becomes not a number."""
    codes = np.asarray(code)
    return np.where(codes > 0, (codes.astype("float32") - 1.0) / STUFEN,
                    np.nan).astype("float32")


def kachelraster(west: float, south: float, east: float, north: float,
                 zoom: int) -> tuple[int, int, int, int]:
    """Tile indices that cover a box given in EPSG:3857."""
    weite = 2 * RAND / 2 ** zoom
    tx0 = int(math.floor((west + RAND) / weite))
    tx1 = int(math.floor((east + RAND) / weite))
    ty0 = int(math.floor((RAND - north) / weite))
    ty1 = int(math.floor((RAND - south) / weite))
    return tx0, ty0, tx1, ty1


def kachelbox(tx0: int, ty0: int, tx1: int, ty1: int,
              zoom: int) -> tuple[float, float, float, float]:
    """The exact EPSG:3857 extent of a block of tiles."""
    weite = 2 * RAND / 2 ** zoom
    return (-RAND + tx0 * weite, RAND - (ty1 + 1) * weite,
            -RAND + (tx1 + 1) * weite, RAND - ty0 * weite)

"""One tile pyramid for every layer.

A source raster carries a zoom span. ``finest_zoom`` reads that span from the
step of the source. The finest level comes from the source, and each coarser
level is the mean of the four tiles above it. The coding stays the same on
every level: one byte per point, byte 0 for no data, bytes 1 to 255 linear
over the scale of the layer. A tile without data is not written.
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from pathlib import Path

import numpy as np

from tiles import KACHEL, RAND

# Zoom 5 zeigt Deutschland, Zoom 14 ist die letzte Stufe der Grundkarte.
ZOOM_BASE = 5
ZOOM_CAP = 14
# Der Punkt einer Kachel auf Zoom 0, in Metern am Aequator.
RESOLUTION_ZERO = 2 * RAND / KACHEL
CENTRE_LATITUDE = 51.2
STUFEN = 254.0


def finest_zoom(resolution_m: float, cap: int = ZOOM_CAP, base: int = ZOOM_BASE) -> int:
    """The finest zoom that a source of this step carries."""
    ground = RESOLUTION_ZERO * math.cos(math.radians(CENTRE_LATITUDE))
    zoom = math.ceil(math.log2(ground / resolution_m)) + 1
    return max(base, min(cap, zoom))


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


def halve(codes: np.ndarray) -> np.ndarray:
    """Average each block of two by two points into one point."""
    valid = codes > 0
    value = np.where(valid, (codes.astype("float32") - 1.0) / STUFEN, 0.0)
    rows, cols = codes.shape
    shape = (rows // 2, 2, cols // 2, 2)
    total = value.reshape(shape).sum(axis=(1, 3))
    count = valid.reshape(shape).sum(axis=(1, 3))
    mean = np.divide(total, count, out=np.full(total.shape, np.nan, dtype="float32"),
                     where=count > 0)
    return to_byte(mean)


def class_shares(block: np.ndarray, groups: Mapping[str, Iterable[int]]
                 ) -> dict[str, np.ndarray]:
    """Turn a raster of class numbers into one field of 0 or 1 per group.

    Class 0 is no data and stays no data in every field.
    """
    known = block > 0
    fields: dict[str, np.ndarray] = {}
    for name, codes in groups.items():
        hit = np.isin(block, list(codes)).astype("float32")
        fields[name] = np.where(known, hit, np.nan).astype("float32")
    return fields


def tile_file(root: Path, zoom: int, x: int, y: int) -> Path:
    return root / str(zoom) / str(x) / f"{y}.png"


def write_tile(root: Path, zoom: int, x: int, y: int, code: np.ndarray) -> bool:
    """Write one tile. A tile without data is left out and returns False."""
    from PIL import Image

    if not code.any():
        return False
    datei = tile_file(root, zoom, x, y)
    datei.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(code, mode="L").save(datei, optimize=True)
    return True


def read_tile(root: Path, zoom: int, x: int, y: int) -> np.ndarray | None:
    from PIL import Image

    datei = tile_file(root, zoom, x, y)
    if not datei.exists():
        return None
    with Image.open(datei) as bild:
        return np.asarray(bild.convert("L"), dtype="uint8")


def tiles_at(root: Path, zoom: int) -> list[tuple[int, int]]:
    """The tiles that one zoom level holds, as (x, y)."""
    folder = root / str(zoom)
    if not folder.is_dir():
        return []
    found: list[tuple[int, int]] = []
    for spalte in folder.iterdir():
        if not (spalte.is_dir() and spalte.name.isdigit()):
            continue
        for datei in spalte.glob("*.png"):
            if datei.stem.isdigit():
                found.append((int(spalte.name), int(datei.stem)))
    return found


def coarsen(root: Path, finest: int, base: int = ZOOM_BASE
            ) -> list[tuple[int, int, int]]:
    """Build every level from ``finest - 1`` down to ``base``."""
    written: list[tuple[int, int, int]] = []
    for zoom in range(finest, base, -1):
        parents = {(x // 2, y // 2) for x, y in tiles_at(root, zoom)}
        for px, py in sorted(parents):
            canvas = np.zeros((2 * KACHEL, 2 * KACHEL), dtype="uint8")
            for dy in (0, 1):
                for dx in (0, 1):
                    kind = read_tile(root, zoom, 2 * px + dx, 2 * py + dy)
                    if kind is None:
                        continue
                    canvas[dy * KACHEL:(dy + 1) * KACHEL,
                           dx * KACHEL:(dx + 1) * KACHEL] = kind
            if write_tile(root, zoom - 1, px, py, halve(canvas)):
                written.append((zoom - 1, px, py))
    return written


def belegung(filled: Iterable[tuple[int, int, int]]) -> dict[str, list[str]]:
    """The ``have`` list of a manifest: per zoom the tiles that carry data."""
    belegt: dict[str, list[str]] = {}
    for z, x, y in sorted(filled):
        belegt.setdefault(str(z), []).append(f"{x}/{y}")
    return belegt

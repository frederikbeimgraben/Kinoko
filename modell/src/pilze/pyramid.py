"""One tile pyramid for every layer.

``finest_zoom`` reads the zoom span from the step of the source. The finest
level comes from the source. Each coarser level is the mean of the four tiles
above it. The coding of ``tiles.py`` holds on every level.
"""

from __future__ import annotations

import math
import shutil
from collections.abc import Iterable, Mapping
from pathlib import Path

import numpy as np

from tiles import KACHEL, RAND, from_byte, kachelbox, kachelraster, to_byte

# Zoom 5 shows Germany. Zoom 14 is the last level of the base map.
ZOOM_BASE = 5
ZOOM_CAP = 14
# Metres per point at zoom 0, on the equator.
RESOLUTION_ZERO = 2 * RAND / KACHEL
CENTRE_LATITUDE = 51.2


def finest_zoom(resolution_m: float, cap: int = ZOOM_CAP, base: int = ZOOM_BASE) -> int:
    """The finest zoom that a source of this step carries."""
    ground = RESOLUTION_ZERO * math.cos(math.radians(CENTRE_LATITUDE))
    zoom = math.ceil(math.log2(ground / resolution_m)) + 1
    return max(base, min(cap, zoom))


def full_weight(codes: np.ndarray) -> np.ndarray:
    """The weight of the finest level. A point is full, or it has no data."""
    return np.where(codes > 0, 255, 0).astype("uint8")


def halve(codes: np.ndarray, weights: np.ndarray
          ) -> tuple[np.ndarray, np.ndarray]:
    """Average each block of two by two points into one point.

    ``weights`` holds the area behind each point. The result is the mean value
    and the mean weight.
    """
    rows, cols = codes.shape
    shape = (rows // 2, 2, cols // 2, 2)
    value = np.nan_to_num(from_byte(codes), nan=0.0)
    weight = np.nan_to_num(from_byte(weights), nan=0.0)
    total = (value * weight).reshape(shape).sum(axis=(1, 3))
    mass = weight.reshape(shape).sum(axis=(1, 3))
    mean = np.divide(total, mass, out=np.full(total.shape, np.nan, dtype="float32"),
                     where=mass > 0)
    return to_byte(mean), to_byte(np.where(mass > 0, mass / 4.0, np.nan))


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
    """Write one tile. A tile without data returns False and writes nothing."""
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


def _canvas(root: Path, zoom: int, px: int, py: int) -> np.ndarray:
    """The four tiles above one tile, side by side. A gap stays byte 0."""
    canvas = np.zeros((2 * KACHEL, 2 * KACHEL), dtype="uint8")
    for dy in (0, 1):
        for dx in (0, 1):
            kind = read_tile(root, zoom, 2 * px + dx, 2 * py + dy)
            if kind is not None:
                canvas[dy * KACHEL:(dy + 1) * KACHEL,
                       dx * KACHEL:(dx + 1) * KACHEL] = kind
    return canvas


def coarsen(root: Path, weights: Path, finest: int, base: int = ZOOM_BASE
            ) -> list[tuple[int, int, int]]:
    """Build every level from ``finest - 1`` down to ``base``.

    ``weights`` is the weight tree beside the value tree. The caller writes its
    finest level with ``full_weight``.
    """
    written: list[tuple[int, int, int]] = []
    for zoom in range(finest, base, -1):
        parents = {(x // 2, y // 2) for x, y in tiles_at(root, zoom)}
        for px, py in sorted(parents):
            code, mass = halve(_canvas(root, zoom, px, py),
                               _canvas(weights, zoom, px, py))
            write_tile(weights, zoom - 1, px, py, mass)
            if write_tile(root, zoom - 1, px, py, code):
                written.append((zoom - 1, px, py))
    return written


def cut_field(code: np.ndarray, root: Path, weights: Path, zoom: int,
              tx0: int, ty0: int) -> list[tuple[int, int, int]]:
    """Cut one coded field into tiles, starting at tile ``tx0``, ``ty0``."""
    written: list[tuple[int, int, int]] = []
    rows, cols = code.shape
    for j in range(rows // KACHEL):
        for i in range(cols // KACHEL):
            kachel = code[j * KACHEL:(j + 1) * KACHEL, i * KACHEL:(i + 1) * KACHEL]
            x, y = tx0 + i, ty0 + j
            if write_tile(root, zoom, x, y, kachel):
                write_tile(weights, zoom, x, y, full_weight(kachel))
                written.append((zoom, x, y))
    return written


def render_field(quelle: Path, targets: list[Path], tops: list[float],
                 zoom: int, arbeit: Path,
                 wgs_box: tuple[float, float, float, float],
                 base: int = ZOOM_BASE
                 ) -> list[tuple[list[tuple[int, int, int]], int]]:
    """Cut every band of a source into its own pyramid.

    ``quelle`` is a GeoTIFF in any CRS with one band per pyramid. ``wgs_box``
    is its extent as (west, south, east, north) in degrees. One gdalwarp hits
    the finest level, and the levels below it come from the mean of the four
    tiles above. The result names, per band, the tiles that carry data.
    """
    import rasterio
    import subprocess

    west, south = to_mercator(wgs_box[0], wgs_box[1])
    east, north = to_mercator(wgs_box[2], wgs_box[3])
    tx0, ty0, tx1, ty1 = kachelraster(west, south, east, north, zoom)
    box = kachelbox(tx0, ty0, tx1, ty1, zoom)
    breite, hoehe = (tx1 - tx0 + 1) * KACHEL, (ty1 - ty0 + 1) * KACHEL
    gewarpt = arbeit / f"z{zoom}.tif"
    # gdalwarp trifft das Kachelraster genau, wenn Ausschnitt und Punktzahl
    # vorgegeben sind. Selbst skaliert saesse es daneben.
    subprocess.run(
        ["gdalwarp", "-q", "-overwrite", "-t_srs", "EPSG:3857",
         "-te", *[f"{v:.6f}" for v in box], "-ts", str(breite), str(hoehe),
         "-r", "average", "-dstnodata", "nan",
         # Jedes Band traegt seine eigene Maske: der Regen der letzten acht
         # Wochen fehlt am Anfang der Reihe, wo der der Woche schon dasteht.
         "-wo", "UNIFIED_SRC_NODATA=NO",
         str(quelle), str(gewarpt)],
        check=True, capture_output=True)

    saetze: list[tuple[list[tuple[int, int, int]], int]] = []
    with rasterio.open(gewarpt) as src:
        for band, (target, top) in enumerate(zip(targets, tops), start=1):
            weights = arbeit / "gewicht" / target.name
            shutil.rmtree(weights, ignore_errors=True)
            gefuellt = cut_field(to_byte(src.read(band) / max(top, 1e-6)),
                                 target, weights, zoom, tx0, ty0)
            gefuellt += coarsen(target, weights, zoom, base)
            shutil.rmtree(weights, ignore_errors=True)
            bytes_ = sum(tile_file(target, z, x, y).stat().st_size
                         for z, x, y in gefuellt)
            saetze.append((gefuellt, bytes_))
    gewarpt.unlink(missing_ok=True)
    return saetze


def belegung(filled: Iterable[tuple[int, int, int]]) -> dict[str, list[str]]:
    """The ``have`` list of a manifest: per zoom the tiles that carry data."""
    belegt: dict[str, list[str]] = {}
    for z, x, y in sorted(filled):
        belegt.setdefault(str(z), []).append(f"{x}/{y}")
    return belegt


def have_up_to(filled: Iterable[tuple[int, int, int]], cap: int
               ) -> dict[str, list[str]]:
    """The ``have`` list up to one zoom level.

    Above the cap the app asks the coarser tile over the same place.
    """
    return belegung(tile for tile in filled if tile[0] <= cap)


def to_mercator(lon: float, lat: float) -> tuple[float, float]:
    """A point in degrees as EPSG:3857 metres."""
    x = RAND * lon / 180.0
    y = RAND * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) / math.pi
    return x, y


def block_grid(wgs_box: tuple[float, float, float, float], zoom: int,
               block_tiles: int) -> list[tuple[int, int]]:
    """The blocks of whole tiles that cover a box given in degrees."""
    west, south = to_mercator(wgs_box[0], wgs_box[1])
    east, north = to_mercator(wgs_box[2], wgs_box[3])
    tx0, ty0, tx1, ty1 = kachelraster(west, south, east, north, zoom)
    return [(bx, by)
            for bx in range(tx0 // block_tiles, tx1 // block_tiles + 1)
            for by in range(ty0 // block_tiles, ty1 // block_tiles + 1)]


def block_box(bx: int, by: int, zoom: int, block_tiles: int
              ) -> tuple[float, float, float, float]:
    """The EPSG:3857 extent of one block."""
    return kachelbox(bx * block_tiles, by * block_tiles,
                     (bx + 1) * block_tiles - 1, (by + 1) * block_tiles - 1, zoom)

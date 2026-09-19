#!/usr/bin/env python3
"""Render every layer whose source is finer than the map grid, once.

The weekly run keeps these layers as they are. One block loop serves every
source. A block covers whole tiles of the finest level, so no tile needs two
blocks. ``pyramid.py`` then builds the coarser levels.

Two kinds of source exist. The tree species map of the Thuenen Institute
arrives over a web coverage service, block by block. Elevation, slope,
northness and the soil grids are files that the chain already holds.

Run this in the geo shell:
    nix develop .#geo --command python src/pilze/fine_layers.py
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from manifest import histogram, schreibe, werte_aus_kacheln
from pyramid import (ZOOM_BASE, ZOOM_CAP, block_box, block_grid, coarsen,
                     cut_field, finest_zoom, have_up_to, to_byte)
from tiles import KACHEL

SOURCE_CRS = "EPSG:32632"
MERCATOR = "EPSG:3857"
STATE = "_fine_layers_stand.json"
WALD = "wald"
# The credit that CC BY 4.0 asks for.
THUENEN = ("10-m-Raster, Thünen-Institut, Dominant Tree Species for Germany "
           "(2017/2018), CC BY 4.0")
COPERNICUS = "90-m-Raster, Copernicus DEM GLO-90"
SOILGRIDS = "250-m-Raster, SoilGrids, ISRIC"


@dataclass(frozen=True)
class FineLayer:
    """One layer, its source and the scale that a byte stands for."""

    name: str
    label: str
    unit: str
    resolution: float
    low: float
    high: float
    note: str
    classes: tuple[int, ...] = ()
    path: str = ""
    scale: float = 1.0
    nodata: float = 0.0
    offline_zoom: int = 12


def _tree(name: str, label: str, classes: tuple[int, ...]) -> FineLayer:
    return FineLayer(name=name, label=label, unit="", resolution=10.0,
                     low=0.0, high=1.0, note=THUENEN, classes=classes)


# The classes of the Thuenen map per layer.
TREES: dict[str, FineLayer] = {
    WALD: _tree(WALD, "Waldanteil", ()),
    "fichte": _tree("fichte", "Fichte", (8,)),
    "buche": _tree("buche", "Buche", (3,)),
    "eiche": _tree("eiche", "Eiche", (5,)),
    "birke": _tree("birke", "Birke", (2,)),
    "kiefer": _tree("kiefer", "Kiefer", (9,)),
    "nadelholz": _tree("nadelholz", "Nadelholz", (4, 8, 9, 10, 14)),
}

STATIC_DIR = "data/interim/static"
SOIL_DIR = "data/raw/soil"
RASTERS: dict[str, FineLayer] = {
    "hoehe": FineLayer("hoehe", "Höhe", "m", 90.0, 0.0, 2000.0, COPERNICUS,
                       path=f"{STATIC_DIR}/dem90_3035.tif", nodata=-32767.0),
    "hangneigung": FineLayer("hangneigung", "Hangneigung", "Grad", 90.0,
                             0.0, 45.0, COPERNICUS,
                             path=f"{STATIC_DIR}/slope90.tif", nodata=-9999.0),
    "nordexposition": FineLayer("nordexposition", "Nordexposition", "", 90.0,
                                -1.0, 1.0, COPERNICUS,
                                path=f"{STATIC_DIR}/northness90.tif",
                                nodata=-9999.0),
    "boden_ph": FineLayer("boden_ph", "Boden-pH", "", 250.0, 3.5, 8.5,
                          SOILGRIDS, path=f"{SOIL_DIR}/phh2o_0-5cm_mean.tif",
                          scale=0.1),
    "boden_sand": FineLayer("boden_sand", "Sandanteil", "%", 250.0, 0.0, 100.0,
                            SOILGRIDS, path=f"{SOIL_DIR}/sand_0-5cm_mean.tif",
                            scale=0.1),
    "boden_kohlenstoff": FineLayer("boden_kohlenstoff",
                                   "organischer Kohlenstoff", "g/kg", 250.0,
                                   0.0, 200.0, SOILGRIDS,
                                   path=f"{SOIL_DIR}/soc_0-5cm_mean.tif",
                                   scale=0.1),
}


def layer_zoom(layer: FineLayer, cap: int = ZOOM_CAP) -> int:
    """The finest zoom that the source of this layer carries."""
    return finest_zoom(layer.resolution, cap=cap)


def scale_field(raw: np.ndarray, layer: FineLayer) -> np.ndarray:
    """Read a source field as a share of 0 to 1 over the scale of the layer."""
    value = np.asarray(raw, dtype="float32")
    known = np.isfinite(value) & (value != layer.nodata)
    value = value * layer.scale
    share = np.clip((value - layer.low) / (layer.high - layer.low), 0.0, 1.0)
    return np.where(known, share, np.nan).astype("float32")


def layer_value(share: np.ndarray, layer: FineLayer) -> np.ndarray:
    """The value of the layer behind a share of 0 to 1."""
    return (layer.low + np.asarray(share, dtype="float32")
            * (layer.high - layer.low)).astype("float32")


def tree_fields(block: np.ndarray, inland: np.ndarray) -> dict[str, np.ndarray]:
    """One field of 0 or 1 per tree layer, from one block of class numbers.

    ``inland`` marks Germany. A tree species holds for the forest area, so
    ground without forest carries no value. The forest share holds for the
    ground, so it is 0 outside the forest and no value outside Germany.
    """
    forest = block > 0
    known = np.asarray(inland) > 0
    fields: dict[str, np.ndarray] = {
        WALD: np.where(known, forest.astype("float32"), np.nan).astype("float32")
    }
    for name, layer in TREES.items():
        if not layer.classes:
            continue
        hit = np.isin(block, list(layer.classes)).astype("float32")
        fields[name] = np.where(forest, hit, np.nan).astype("float32")
    return fields


def utm_box(merc: tuple[float, float, float, float], margin: float
            ) -> tuple[float, float, float, float]:
    """The UTM box that covers a box given in EPSG:3857."""
    from pyproj import Transformer

    nach_utm = Transformer.from_crs(MERCATOR, SOURCE_CRS, always_xy=True)
    ecken = [nach_utm.transform(x, y)
             for x in (merc[0], merc[2]) for y in (merc[1], merc[3])]
    xs, ys = zip(*ecken)
    return (min(xs) - margin, min(ys) - margin, max(xs) + margin, max(ys) + margin)


def write_bands(fields: dict[str, np.ndarray], names: list[str], target: Path,
                crs, transform) -> None:
    """Write one band per layer into one GeoTIFF."""
    import rasterio

    form = fields[names[0]].shape
    with rasterio.open(target, "w", driver="GTiff", height=form[0],
                       width=form[1], count=len(names), dtype="float32",
                       crs=crs, transform=transform, nodata=np.nan) as dst:
        for band, name in enumerate(names, start=1):
            dst.write(fields[name], band)


def warp_block(source: Path, target: Path,
               merc: tuple[float, float, float, float], side: int) -> None:
    """Warp every band onto the tile grid of the block."""
    subprocess.run(
        ["gdalwarp", "-q", "-overwrite", "-t_srs", MERCATOR,
         "-te", *[f"{v:.6f}" for v in merc], "-ts", str(side), str(side),
         "-r", "average", "-dstnodata", "nan",
         "-wo", "UNIFIED_SRC_NODATA=NO", str(source), str(target)],
        check=True, capture_output=True)


def rasterize_inland(outline: Path, target: Path,
                     box_utm: tuple[float, float, float, float],
                     pixel: float) -> np.ndarray:
    """Burn the outline of Germany onto the grid of one block."""
    import rasterio

    width = max(1, int(round((box_utm[2] - box_utm[0]) / pixel)))
    height = max(1, int(round((box_utm[3] - box_utm[1]) / pixel)))
    subprocess.run(
        ["gdal_rasterize", "-q", "-burn", "1", "-init", "0", "-ot", "Byte",
         "-a_srs", SOURCE_CRS, "-te", *[f"{v:.3f}" for v in box_utm],
         "-ts", str(width), str(height), str(outline), str(target)],
        check=True, capture_output=True)
    with rasterio.open(target) as src:
        return src.read(1)


def cut_block(warped: Path, names: list[str], roots: dict[str, Path],
              weights: dict[str, Path], zoom: int, bx: int, by: int,
              block_tiles: int) -> dict[str, list[str]]:
    """Cut the bands of one block into tiles and write them."""
    import rasterio

    written: dict[str, list[str]] = {}
    with rasterio.open(warped) as src:
        for band, name in enumerate(names, start=1):
            gefuellt = cut_field(to_byte(src.read(band)), roots[name],
                                 weights[name], zoom,
                                 bx * block_tiles, by * block_tiles)
            written[name] = [f"{z}/{x}/{y}" for z, x, y in gefuellt]
    return written


def read_state(path: Path, names: list[str]) -> dict:
    if not path.exists():
        return {"blocks": [], "tiles": {name: [] for name in names}}
    state = json.loads(path.read_text())
    for name in names:
        state["tiles"].setdefault(name, [])
    return state


def write_state(path: Path, state: dict) -> None:
    path.write_text(json.dumps(state))


def tree_block(merc: tuple[float, float, float, float], outline: Path,
               work: Path, names: list[str]) -> Path | None:
    """One block of the tree species map, as one band per layer."""
    import rasterio

    from tree_species import fetch

    raw, bands = work / "block.tif", work / "block_shares.tif"
    box = utm_box(merc, 200.0)
    if not fetch(box, raw):
        return None
    with rasterio.open(raw) as src:
        classes = src.read(1)
        crs, transform = src.crs, src.transform
    inland = rasterize_inland(outline, work / "block_mask.tif", box,
                              abs(transform.a))
    if inland.shape != classes.shape:
        inland = np.ones(classes.shape, dtype="uint8")
    if not (classes > 0).any() and not inland.any():
        return None
    write_bands(tree_fields(classes, inland), names, bands, crs, transform)
    return bands


def raster_block(merc: tuple[float, float, float, float], side: int,
                 work: Path, layers: list[FineLayer]) -> Path | None:
    """One block of the file sources, as one band per layer."""
    import rasterio

    bands = work / "block_shares.tif"
    fields: dict[str, np.ndarray] = {}
    crs = transform = None
    merc_pixel = (merc[2] - merc[0]) / side
    for layer in layers:
        cut = work / f"cut_{layer.name}.tif"
        subprocess.run(
            ["gdalwarp", "-q", "-overwrite", "-t_srs", MERCATOR,
             "-te", *[f"{v:.6f}" for v in merc],
             "-tr", f"{merc_pixel:.6f}", f"{merc_pixel:.6f}",
             "-r", "average", "-ot", "Float32",
             "-srcnodata", str(layer.nodata), "-dstnodata", "nan",
             str(Path(layer.path)), str(cut)],
            check=True, capture_output=True)
        with rasterio.open(cut) as src:
            fields[layer.name] = scale_field(src.read(1), layer)
            crs, transform = src.crs, src.transform
        cut.unlink(missing_ok=True)
    if crs is None or all(np.isnan(f).all() for f in fields.values()):
        return None
    write_bands(fields, [layer.name for layer in layers], bands, crs, transform)
    return bands


def update_manifest(path: Path, layers: list[FineLayer], roots: dict[str, Path],
                    filled: dict[str, list[str]], zooms: dict[str, int],
                    have_zoom: int) -> None:
    """Put the zoom span, the tile list and the credit into the manifest."""
    meta = json.loads(path.read_text()) if path.exists() else {"layers": {}}
    meta.setdefault("layers", {})
    for layer in layers:
        tiles = [(int(z), int(x), int(y))
                 for z, x, y in (key.split("/") for key in filled[layer.name])]
        eintrag = meta["layers"].get(layer.name, {})
        eintrag.update(label=layer.label, note=layer.note, unit=layer.unit,
                       static=True, low=layer.low, high=layer.high,
                       tiles=f"layers_kacheln/{layer.name}",
                       zooms=[ZOOM_BASE, zooms[layer.name]],
                       haveZoom=have_zoom, offlineZoomTo=layer.offline_zoom,
                       have=have_up_to(tiles, have_zoom))
        zoom = str(ZOOM_BASE + 2)
        werte = werte_aus_kacheln(roots[layer.name], eintrag["have"].get(zoom, []),
                                  zoom, layer.low, layer.high)
        if werte is not None:
            verteilung = histogram(werte, layer.low, layer.high)
            if verteilung is not None:
                eintrag["histogram"] = verteilung
        meta["layers"][layer.name] = eintrag
    schreibe(path, meta)


def build_outline(pbf: Path, target: Path) -> Path:
    """Cut the outline of Germany out of the OpenStreetMap extract."""
    if target.exists():
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    level2 = target.with_suffix(".osm.pbf")
    subprocess.run(["osmium", "tags-filter", str(pbf), "r/admin_level=2",
                    "-o", str(level2), "--overwrite"],
                   check=True, capture_output=True)
    # gdal_rasterize projiziert nicht. Der Umriss liegt daher im CRS der
    # Quelle.
    subprocess.run(["ogr2ogr", "-f", "GeoJSON", "-t_srs", SOURCE_CRS,
                    str(target), str(level2), "multipolygons",
                    "-where", "admin_level = '2'", "-select", "name"],
                   check=True, capture_output=True)
    level2.unlink(missing_ok=True)
    return target


def group_of(name: str) -> str:
    return "trees" if name in TREES else "rasters"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("reports/maps"))
    parser.add_argument("--work", type=Path, default=Path("reports/maps/_work_fine"))
    parser.add_argument("--osm", type=Path,
                        default=Path("data/raw/osm/germany-latest.osm.pbf"))
    parser.add_argument("--outline", type=Path,
                        default=Path("data/interim/germany.geojson"))
    parser.add_argument("--region", default="de")
    parser.add_argument("--bbox", help="west,sued,ost,nord in Grad statt --region")
    parser.add_argument("--only", help="nur diese Ebenen, mit Komma getrennt")
    parser.add_argument("--zoom-cap", type=int, default=ZOOM_CAP)
    parser.add_argument("--block-tiles", type=int, default=16)
    parser.add_argument("--have-zoom", type=int, default=10)
    parser.add_argument("--pause", type=float, default=2.0)
    parser.add_argument("--restart", action="store_true")
    args = parser.parse_args()

    from region_map import REGIONEN

    alle = {**TREES, **RASTERS}
    gewaehlt = args.only.split(",") if args.only else list(alle)
    layers = [alle[name] for name in gewaehlt]
    box = (tuple(float(v) for v in args.bbox.split(",")) if args.bbox
           else REGIONEN[args.region])
    zooms = {layer.name: layer_zoom(layer, cap=args.zoom_cap) for layer in layers}
    args.work.mkdir(parents=True, exist_ok=True)
    roots = {layer.name: args.out / "layers_kacheln" / layer.name for layer in layers}
    weights = {layer.name: args.work / "gewicht" / layer.name for layer in layers}

    state_path = args.work / STATE
    if args.restart:
        state_path.unlink(missing_ok=True)
    if not state_path.exists():
        for folder in (*roots.values(), *weights.values()):
            shutil.rmtree(folder, ignore_errors=True)
    state = read_state(state_path, list(roots))
    done = set(state["blocks"])

    outline = (build_outline(args.osm, args.outline)
               if any(layer.name == WALD for layer in layers) else args.outline)
    start = time.time()
    for zoom in sorted({zooms[layer.name] for layer in layers}, reverse=True):
        stufe = [layer for layer in layers if zooms[layer.name] == zoom]
        names = [layer.name for layer in stufe]
        kind = group_of(names[0])
        bloecke = block_grid(box, zoom, args.block_tiles)
        side = args.block_tiles * KACHEL
        print(f"zoom {ZOOM_BASE}..{zoom}, {len(bloecke)} blocks, "
              f"{', '.join(names)}", flush=True)
        for count, (bx, by) in enumerate(bloecke, start=1):
            key = f"{zoom}_{bx}_{by}"
            if key in done:
                continue
            merc = block_box(bx, by, zoom, args.block_tiles)
            bands = (tree_block(merc, outline, args.work, names) if kind == "trees"
                     else raster_block(merc, side, args.work, stufe))
            if bands is not None:
                warped = args.work / "block_3857.tif"
                warp_block(bands, warped, merc, side)
                for name, keys in cut_block(warped, names, roots, weights, zoom,
                                            bx, by, args.block_tiles).items():
                    state["tiles"][name].extend(keys)
                warped.unlink(missing_ok=True)
                bands.unlink(missing_ok=True)
            state["blocks"].append(key)
            write_state(state_path, state)
            gesamt = sum(len(v) for v in state["tiles"].values())
            print(f"  [{count}/{len(bloecke)}] {key}: "
                  f"{'data' if bands is not None else 'empty'}, {gesamt} tiles, "
                  f"{time.time() - start:.0f} s", flush=True)
            if bands is not None and kind == "trees":
                time.sleep(args.pause)

    filled = {name: list(keys) for name, keys in state["tiles"].items()}
    for layer in layers:
        for z, x, y in coarsen(roots[layer.name], weights[layer.name],
                               zooms[layer.name], ZOOM_BASE):
            filled[layer.name].append(f"{z}/{x}/{y}")
        print(f"  {layer.name}: {len(filled[layer.name])} tiles", flush=True)
    update_manifest(args.out / "layers.json", layers, roots, filled, zooms,
                    args.have_zoom)
    print(f"\nwrote {sum(len(filled[l.name]) for l in layers)} tiles in "
          f"{time.time() - start:.0f} s")


if __name__ == "__main__":
    main()

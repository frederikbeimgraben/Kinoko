#!/usr/bin/env python3
"""Render the tree species layers from the 10 m source, once.

The weekly run keeps these layers as they are. This step reads the map of
dominant tree species block by block, turns each class group into a share of
the forest area, and writes the tile pyramid that ``pyramid.py`` defines. A
block that is complete goes into the state file, so a new run continues where
the last one stopped.

Run this in the geo shell:
    nix develop .#geo --command python src/pilze/tree_tiles.py
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from manifest import histogramm, schreibe, werte_aus_kacheln
from pyramid import (ZOOM_BASE, block_box, block_grid, class_shares, coarsen,
                     finest_zoom, full_weight, have_up_to, to_byte, write_tile)
from region_map import REGIONEN
from tiles import KACHEL
from tree_species import COVERAGE, USER_AGENT, WCS, fetch

# Die Klassen der Thuenen-Karte je Ebene. Nadelholz fasst die fuenf
# Nadelbaum-Klassen zusammen.
GROUPS: dict[str, tuple[int, ...]] = {
    "fichte": (8,), "buche": (3,), "eiche": (5,), "birke": (2,),
    "kiefer": (9,), "nadelholz": (4, 8, 9, 10, 14),
}
LABELS = {"fichte": "Fichte", "buche": "Buche", "eiche": "Eiche",
          "birke": "Birke", "kiefer": "Kiefer", "nadelholz": "Nadelholz"}
RESOLUTION = 10
SOURCE_CRS = "EPSG:32632"
MERCATOR = "EPSG:3857"
STATE = "_baumarten_stand.json"
# Der Anteil gilt an der Waldflaeche und laeuft von 0 bis 1.
LOW, HIGH = 0.0, 1.0


def utm_box(merc: tuple[float, float, float, float], margin: float
            ) -> tuple[float, float, float, float]:
    """The UTM box that covers a box given in EPSG:3857."""
    from pyproj import Transformer

    nach_utm = Transformer.from_crs(MERCATOR, SOURCE_CRS, always_xy=True)
    ecken = [nach_utm.transform(x, y)
             for x in (merc[0], merc[2]) for y in (merc[1], merc[3])]
    xs, ys = zip(*ecken)
    return (min(xs) - margin, min(ys) - margin, max(xs) + margin, max(ys) + margin)


def write_shares(raw: Path, target: Path) -> bool:
    """Turn the classes of one block into one band of shares per layer."""
    import rasterio

    with rasterio.open(raw) as src:
        classes = src.read(1)
        crs, transform = src.crs, src.transform
    if not (classes > 0).any():
        return False
    fields = class_shares(classes, GROUPS)
    with rasterio.open(target, "w", driver="GTiff", height=classes.shape[0],
                       width=classes.shape[1], count=len(GROUPS), dtype="float32",
                       crs=crs, transform=transform, nodata=np.nan) as dst:
        for band, name in enumerate(GROUPS, start=1):
            dst.write(fields[name], band)
    return True


def warp_block(source: Path, target: Path,
               merc: tuple[float, float, float, float], side: int) -> None:
    """Warp every band onto the tile grid of the block."""
    subprocess.run(
        ["gdalwarp", "-q", "-overwrite", "-t_srs", MERCATOR,
         "-te", *[f"{v:.6f}" for v in merc], "-ts", str(side), str(side),
         "-r", "average", "-dstnodata", "nan",
         "-wo", "UNIFIED_SRC_NODATA=NO", str(source), str(target)],
        check=True, capture_output=True)


def cut_block(warped: Path, roots: dict[str, Path], weights: dict[str, Path],
              zoom: int, bx: int, by: int, block_tiles: int) -> dict[str, list[str]]:
    """Cut the bands of one block into tiles and write them."""
    import rasterio

    written: dict[str, list[str]] = {name: [] for name in roots}
    with rasterio.open(warped) as src:
        for band, name in enumerate(GROUPS, start=1):
            code = to_byte(src.read(band))
            for j in range(block_tiles):
                for i in range(block_tiles):
                    kachel = code[j * KACHEL:(j + 1) * KACHEL,
                                  i * KACHEL:(i + 1) * KACHEL]
                    x, y = bx * block_tiles + i, by * block_tiles + j
                    if write_tile(roots[name], zoom, x, y, kachel):
                        write_tile(weights[name], zoom, x, y, full_weight(kachel))
                        written[name].append(f"{zoom}/{x}/{y}")
    return written


def read_state(path: Path) -> dict:
    if not path.exists():
        return {"blocks": [], "tiles": {name: [] for name in GROUPS}}
    return json.loads(path.read_text())


def write_state(path: Path, state: dict) -> None:
    path.write_text(json.dumps(state))


def update_manifest(path: Path, roots: dict[str, Path], filled: dict[str, list],
                    zoom: int, have_zoom: int, offline_zoom: int) -> None:
    """Put the new zoom span and the tile lists into the layer manifest."""
    meta = json.loads(path.read_text()) if path.exists() else {"layers": {}}
    for name, root in roots.items():
        tiles = [(int(z), int(x), int(y))
                 for z, x, y in (key.split("/") for key in filled[name])]
        eintrag = meta["layers"].get(name, {})
        eintrag.update(label=LABELS[name], unit="", static=True,
                       low=LOW, high=HIGH,
                       tiles=f"layers_kacheln/{name}",
                       zooms=[ZOOM_BASE, zoom],
                       haveZoom=have_zoom, offlineZoomTo=offline_zoom,
                       have=have_up_to(tiles, have_zoom))
        werte = werte_aus_kacheln(
            root, eintrag["have"].get(str(ZOOM_BASE + 2), []),
            str(ZOOM_BASE + 2), LOW, HIGH)
        if werte is not None:
            verteilung = histogramm(werte, LOW, HIGH)
            if verteilung is not None:
                eintrag["histogramm"] = verteilung
        meta["layers"][name] = eintrag
    schreibe(path, meta)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("reports/maps"))
    parser.add_argument("--work", type=Path, default=Path("reports/maps/_work_trees"))
    parser.add_argument("--region", default="de")
    parser.add_argument("--bbox", help="west,sued,ost,nord in Grad statt --region")
    parser.add_argument("--zoom-cap", type=int, default=finest_zoom(RESOLUTION))
    parser.add_argument("--block-tiles", type=int, default=16)
    parser.add_argument("--have-zoom", type=int, default=10)
    parser.add_argument("--offline-zoom", type=int, default=12)
    parser.add_argument("--pause", type=float, default=2.0)
    parser.add_argument("--restart", action="store_true")
    args = parser.parse_args()

    zoom = finest_zoom(RESOLUTION, cap=args.zoom_cap)
    box = (tuple(float(v) for v in args.bbox.split(",")) if args.bbox
           else REGIONEN[args.region])
    args.work.mkdir(parents=True, exist_ok=True)
    roots = {name: args.out / "layers_kacheln" / name for name in GROUPS}
    weights = {name: args.work / "gewicht" / name for name in GROUPS}

    state_path = args.work / STATE
    if args.restart:
        state_path.unlink(missing_ok=True)
    state = read_state(state_path)
    done = set(state["blocks"])
    bloecke = block_grid(box, zoom, args.block_tiles)
    side = args.block_tiles * KACHEL
    print(f"{WCS} {COVERAGE} as {USER_AGENT}")
    print(f"zoom {ZOOM_BASE}..{zoom}, {len(bloecke)} blocks of {side} points, "
          f"{len(done)} already done", flush=True)

    start = time.time()
    for count, (bx, by) in enumerate(bloecke, start=1):
        key = f"{bx}_{by}"
        if key in done:
            continue
        merc = block_box(bx, by, zoom, args.block_tiles)
        raw, bands, warped = (args.work / n for n in
                              ("block.tif", "block_shares.tif", "block_3857.tif"))
        got = fetch(utm_box(merc, RESOLUTION * 20), raw) and write_shares(raw, bands)
        if got:
            warp_block(bands, warped, merc, side)
            for name, keys in cut_block(warped, roots, weights, zoom, bx, by,
                                        args.block_tiles).items():
                state["tiles"][name].extend(keys)
        for datei in (raw, bands, warped):
            datei.unlink(missing_ok=True)
        state["blocks"].append(key)
        write_state(state_path, state)
        gesamt = sum(len(v) for v in state["tiles"].values())
        print(f"  [{count}/{len(bloecke)}] {key}: {'forest' if got else 'empty'}, "
              f"{gesamt} tiles, {time.time() - start:.0f} s", flush=True)
        if got:
            time.sleep(args.pause)

    filled = {name: list(keys) for name, keys in state["tiles"].items()}
    for name, root in roots.items():
        for z, x, y in coarsen(root, weights[name], zoom, ZOOM_BASE):
            filled[name].append(f"{z}/{x}/{y}")
        print(f"  {name}: {len(filled[name])} tiles", flush=True)
    update_manifest(args.out / "layers.json", roots, filled, zoom,
                    args.have_zoom, args.offline_zoom)
    print(f"\nwrote {sum(len(v) for v in filled.values())} tiles in "
          f"{time.time() - start:.0f} s")


if __name__ == "__main__":
    main()

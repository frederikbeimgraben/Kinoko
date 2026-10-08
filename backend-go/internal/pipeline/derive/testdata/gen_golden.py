"""Write the synthetic inputs and the golden outputs of package derive.

Run it in the geo shell of modell/ from the repository root:

    cd modell && nix develop .#geo -c python \
        ../backend-go/internal/pipeline/derive/testdata/gen_golden.py

Inputs (testdata/in): a tree species map in EPSG:32632 at 10 m, a DEM in
two EPSG:4326 tiles, three SoilGrids rasters and an outline. Each covers a
crop of 20 x 20 km near Kassel. Golden outputs (testdata/golden) come from:

  trees_de_500m.parquet   region_map.tile_trees (WCS replaced by the map file)
                          plus the cell column of trees_germany.main
  tree_scales.parquet     tree_scales.main
  site_500m.parquet       static_features.main with PILZE_CELL_SIZE=500
  dem90_3035.tif, slope90.tif, aspect90.tif, northness90.tif
                          the work files of static_features.main
  maps/                   fine_layers.main (fetch replaced by a cut of the map)
  grid.json               the crop, the fine box and the Germany bounds
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

os.environ["PILZE_CELL_SIZE"] = "500"

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
sys.path.insert(0, str(REPO / "modell" / "src" / "pilze"))

import numpy as np  # noqa: E402
import rasterio  # noqa: E402
from osgeo import gdal  # noqa: E402
from pyproj import Transformer  # noqa: E402
from rasterio.transform import from_origin  # noqa: E402

gdal.UseExceptions()

IN = HERE / "in"
GOLDEN = HERE / "golden"
CENTRE = (9.45, 51.30)
CROP_M = 20_000
FINE_HALF = (0.03, 0.02)
TREE_TILE = 7_000
CLASS_TABLE = [0, 0, 2, 3, 4, 5, 6, 8, 9, 10, 14, 16, 17]


def crop_bounds() -> tuple[int, int, int, int]:
    to3035 = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True)
    x, y = to3035.transform(*CENTRE)
    x0 = int(x // 500 * 500) - CROP_M // 2
    y0 = int(y // 500 * 500) - CROP_M // 2
    return x0, y0, x0 + CROP_M, y0 + CROP_M


def box_in(crs: str, bounds, margin: float) -> tuple[float, float, float, float]:
    t = Transformer.from_crs("EPSG:3035", crs, always_xy=True)
    xs, ys = [], []
    for i in range(11):
        f = i / 10
        for x, y in ((bounds[0] + f * (bounds[2] - bounds[0]), bounds[1]),
                     (bounds[0] + f * (bounds[2] - bounds[0]), bounds[3]),
                     (bounds[0], bounds[1] + f * (bounds[3] - bounds[1])),
                     (bounds[2], bounds[1] + f * (bounds[3] - bounds[1]))):
            a, b = t.transform(x, y)
            xs.append(a)
            ys.append(b)
    return min(xs) - margin, min(ys) - margin, max(xs) + margin, max(ys) + margin


def write(path: Path, data: np.ndarray, crs: str, transform, nodata=None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(path, "w", driver="GTiff", height=data.shape[0], width=data.shape[1],
                       count=1, dtype=data.dtype, crs=crs, transform=transform, nodata=nodata,
                       compress="deflate", predictor=2 if data.dtype.kind in "iu" else 3,
                       tiled=True) as dst:
        dst.write(data, 1)


def make_trees(bounds) -> Path:
    e0, n0, e1, n1 = box_in("EPSG:32632", bounds, 1500)
    e0, n0 = np.floor(e0 / 10) * 10, np.floor(n0 / 10) * 10
    nx, ny = int((e1 - e0) // 10), int((n1 - n0) // 10)
    rows, cols = np.mgrid[0:ny, 0:nx]
    a, b = rows // 23, cols // 29
    h = (a * 73856093) ^ (b * 19349663) ^ ((a * b) % 7919)
    classes = np.array(CLASS_TABLE, dtype="uint8")[h % len(CLASS_TABLE)]
    classes[(h % 997) == 0] = 7
    classes[(h % 1999) == 1] = 200
    path = IN / "trees_32632.tif"
    write(path, classes, "EPSG:32632", from_origin(e0, n0 + ny * 10, 10, 10), nodata=None)
    return path


def make_dem(bounds) -> list[Path]:
    w, s, e, n = box_in("EPSG:4326", bounds, 0.05)
    step = 1 / 1200
    w, n = np.floor(w / step) * step, np.ceil(n / step) * step
    nx, ny = int((e - w) / step) + 1, int((n - s) / step) + 1
    lon = w + (np.arange(nx) + 0.5) * step
    lat = n - (np.arange(ny) + 0.5) * step
    lo, la = np.meshgrid(lon, lat)
    z = (300 + 180 * np.sin(lo * 37.0) * np.cos(la * 41.0) + 60 * np.sin(lo * 211.0 + la * 97.0)
         + 25 * np.cos(lo * 503.0) * np.sin(la * 389.0)).astype("float32")
    z[(np.abs(lo - CENTRE[0] - 0.05) < 0.01) & (np.abs(la - CENTRE[1] + 0.04) < 0.008)] = -30.0
    z[(np.abs(lo - CENTRE[0] + 0.06) < 0.004) & (np.abs(la - CENTRE[1] - 0.05) < 0.004)] = -32767.0
    half = nx // 2
    out = []
    for name, sl, x0 in (("dem_w.tif", slice(0, half), w), ("dem_e.tif", slice(half, nx), w + half * step)):
        path = IN / "dem" / name
        write(path, np.ascontiguousarray(z[:, sl]), "EPSG:4326", from_origin(x0, n, step, step), nodata=-32767.0)
        out.append(path)
    return out


def make_soil(bounds) -> list[Path]:
    w, s, e, n = box_in("EPSG:4326", bounds, 0.05)
    step = 1 / 400
    w, n = np.floor(w / step) * step, np.ceil(n / step) * step
    nx, ny = int((e - w) / step) + 1, int((n - s) / step) + 1
    rows, cols = np.mgrid[0:ny, 0:nx]
    water = (np.abs(rows - ny * 0.3) < 4) & (np.abs(cols - nx * 0.6) < 9)
    out = []
    for name, base, amp in (("phh2o_0-5cm_mean.tif", 55, 15), ("sand_0-5cm_mean.tif", 400, 250),
                            ("soc_0-5cm_mean.tif", 600, 500)):
        v = (base + amp * np.sin(rows / 7.0) * np.cos(cols / 11.0)).astype("int16")
        v[water] = 0
        path = IN / "soil" / name
        write(path, v, "EPSG:4326", from_origin(w, n, step, step), nodata=-32768)
        out.append(path)
    return out


def make_outline() -> Path:
    lon, lat = CENTRE
    ring = [[lon - 0.12, lat - 0.07], [lon + 0.02, lat - 0.11], [lon + 0.13, lat - 0.02],
            [lon + 0.01, lat + 0.012], [lon + 0.10, lat + 0.09], [lon - 0.11, lat + 0.08],
            [lon - 0.12, lat - 0.07]]
    doc = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"name": "DE"},
           "geometry": {"type": "Polygon", "coordinates": [ring]}}]}
    path = IN / "outline.geojson"
    path.write_text(json.dumps(doc))
    return path


def compress(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    gdal.Translate(str(dst), str(src), creationOptions=["COMPRESS=DEFLATE", "PREDICTOR=3", "TILED=YES"])


def golden_trees(bounds, trees: Path, work: Path) -> Path:
    import region_map as rm

    body = trees.read_bytes()

    class Answer:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return body

    rm.urllib.request.urlopen = lambda *a, **k: Answer()
    rm.time.sleep = lambda s: None
    rm.TILE = TREE_TILE
    grid, _ = rm.tile_trees(bounds, 500, work)
    grid["cell"] = ((grid["x"] // 500).astype(int).astype(str) + "_"
                    + (grid["y"] // 500).astype(int).astype(str))
    out = GOLDEN / "trees_de_500m.parquet"
    grid.to_parquet(out, index=False)
    return out


def golden_scales(grid: Path) -> None:
    import tree_scales

    sys.argv = ["tree_scales", "--grid", str(grid), "--out", str(GOLDEN / "tree_scales.parquet")]
    tree_scales.main()


def golden_site(grid: Path, dem: list[Path], soil: list[Path], root: Path) -> None:
    import static_features

    for folder, files in (("data/raw/dem", dem), ("data/raw/soil", soil)):
        (root / folder).mkdir(parents=True, exist_ok=True)
        for f in files:
            shutil.copy(f, root / folder / f.name)
    os.chdir(root)
    sys.argv = ["static_features", "--cells", str(grid), "--work", "data/interim/static",
                "--out", str(GOLDEN / "site_500m.parquet")]
    static_features.main()
    for name in ("dem90_3035.tif", "slope90.tif", "aspect90.tif", "northness90.tif"):
        compress(root / "data/interim/static" / name, GOLDEN / name)


def golden_fine(trees: Path, outline: Path, root: Path, fine_box) -> None:
    import fine_layers
    import tree_species

    def fetch(box, target, attempts=4):
        e0, n0, e1, n1 = box
        try:
            gdal.Translate(str(target), str(trees),
                           projWin=[float(f"{e0:.0f}"), float(f"{n1:.0f}"), float(f"{e1:.0f}"), float(f"{n0:.0f}")])
        except RuntimeError:
            return False
        return True

    tree_species.fetch = fetch
    outline32632 = root / "outline_32632.geojson"
    gdal.VectorTranslate(str(outline32632), str(outline), format="GeoJSON", dstSRS="EPSG:32632")
    maps = GOLDEN / "maps"
    shutil.rmtree(maps, ignore_errors=True)
    os.chdir(root)
    sys.argv = ["fine_layers", "--out", str(maps), "--work", str(root / "work_fine"),
                "--outline", str(outline32632), "--bbox", ",".join(str(v) for v in fine_box),
                "--only", "wald,fichte,nadelholz,hoehe,hangneigung,nordexposition,boden_ph,boden_sand,boden_kohlenstoff",
                "--pause", "0"]
    fine_layers.main()


def main() -> None:
    from region_map import REGIONEN

    GOLDEN.mkdir(parents=True, exist_ok=True)
    bounds = crop_bounds()
    trees = make_trees(bounds)
    dem = make_dem(bounds)
    soil = make_soil(bounds)
    outline = make_outline()
    fine_box = (round(CENTRE[0] - FINE_HALF[0], 4), round(CENTRE[1] - FINE_HALF[1], 4),
                round(CENTRE[0] + FINE_HALF[0], 4), round(CENTRE[1] + FINE_HALF[1], 4))
    to3035 = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True)
    de = REGIONEN["de"]
    x0, y0 = to3035.transform(de[0], de[1])
    x1, y1 = to3035.transform(de[2], de[3])
    germany = [int(x0 // 500 * 500), int(y0 // 500 * 500), int(x1 // 500 * 500), int(y1 // 500 * 500)]
    (GOLDEN / "grid.json").write_text(json.dumps(
        {"crop": list(bounds), "treeTile": TREE_TILE, "fineBox": list(fine_box), "germany500": germany}, indent=1))
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        grid = golden_trees(bounds, trees, root / "work_trees")
        golden_scales(grid)
        golden_site(grid, dem, soil, root)
        golden_fine(trees, outline, root, fine_box)


if __name__ == "__main__":
    main()

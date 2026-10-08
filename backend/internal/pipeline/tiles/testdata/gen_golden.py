"""Write the golden tiles of the Go package tiles from the Python reference.

Run with the GDAL of the backend shell (3.13.2, root flake nixpkgs), so the
warp is the same code as in Go. The modell geo shell builds GDAL 3.12 from source.
  nix build -o pyenv --impure --expr 'let p = (builtins.getFlake
    "/home/user/Kinoko").inputs.nixpkgs.legacyPackages.x86_64-linux; in
    p.symlinkJoin { name = "g"; paths = [ (p.python3.withPackages (ps:
    [ps.rasterio ps.pyproj ps.pillow ps.numpy])) p.gdal ]; }'
  PATH=$PWD/pyenv/bin:$PATH python gen_golden.py <this testdata folder>

Outputs:
  render/      pyramid.render_field on a synthetic EPSG:3035 field (2 bands)
  coarsen/     pyramid.coarsen on random zoom-12 tiles with gaps
  golden.json  inputs, tile orders, gdalwarp bounds, fine_layers.raster_block
"""
import base64
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "modell" / "src" / "pilze"))
import fine_layers  # noqa: E402
import pyramid  # noqa: E402

out = Path(sys.argv[1]).resolve()

# The synthetic field: 200 x 200 points of 500 m around Kassel. The Go test
# builds the same values with the same integer formula.
NX = NY = 200
X0, Y0, STEP = 4250000.0, 3100000.0, 500.0


def field():
    j, i = np.meshgrid(np.arange(NX), np.arange(NY))
    base = ((i * 37 + j * 91) % 1000) / 1000.0
    one = np.where((i - 100) ** 2 + (j - 80) ** 2 <= 90 ** 2, base * 0.8, np.nan)
    two = np.where(j >= 30, ((i * 13 + j * 7) % 500) / 500.0, np.nan)
    return one.astype("float32"), two.astype("float32")


def write_source(path, bands, nodata=np.nan):
    with rasterio.open(path, "w", driver="GTiff", height=NY, width=NX,
                       count=len(bands), dtype="float32", crs="EPSG:3035",
                       transform=from_origin(X0, Y0, STEP, STEP), nodata=nodata) as dst:
        for k, band in enumerate(bands, start=1):
            dst.write(band, k)


golden = {"nx": NX, "ny": NY, "geoTransform": [X0, STEP, 0.0, Y0, 0.0, -STEP]}
work = Path(tempfile.mkdtemp())
source = work / "field.tif"
write_source(source, field())

# render_field, as region_map.py calls it: wgs_box from the four corners.
from pyproj import Transformer  # noqa: E402
to_wgs = Transformer.from_crs("EPSG:3035", "EPSG:4326", always_xy=True)
bounds = (X0, Y0 - NY * STEP, X0 + NX * STEP, Y0)
corners = [to_wgs.transform(x, y) for x in (bounds[0], bounds[2]) for y in (bounds[1], bounds[3])]
wgs_box = (min(c[0] for c in corners), min(c[1] for c in corners),
           max(c[0] for c in corners), max(c[1] for c in corners))
zoom = pyramid.finest_zoom(STEP)
tops = [0.8, 1.0]
render = out / "render"
shutil.rmtree(render, ignore_errors=True)
targets = [render / "band0", render / "band1"]
sets = pyramid.render_field(source, targets, tops, zoom, work, wgs_box)
golden["render"] = {"wgsBox": list(wgs_box), "zoom": zoom, "tops": tops,
                    "filled": [[list(t) for t in filled] for filled, _ in sets],
                    "have": [pyramid.belegung(filled) for filled, _ in sets]}

# The extent gdalwarp chooses itself, as region_map.schreibe_woche.
merc = work / "merc.tif"
subprocess.run(["gdalwarp", "-q", "-overwrite", "-t_srs", "EPSG:3857", "-r", "bilinear",
                "-dstnodata", "nan", str(source), str(merc)], check=True)
with rasterio.open(merc) as src:
    b = src.bounds
    golden["autoBounds"] = [b.left, b.bottom, b.right, b.top]
    golden["autoSize"] = [src.width, src.height]

# fine_layers.raster_block with a scale of 0..1, so the share is the warped value.
nodata_source = work / "nodata.tif"
one, _ = field()
write_source(nodata_source, [np.where(np.isfinite(one), one, -32767.0).astype("float32")],
             nodata=-32767.0)
layer = fine_layers.FineLayer("probe", "Probe", "", STEP, 0.0, 1.0, "",
                              path=str(nodata_source), nodata=-32767.0)
block_zoom, block_tiles = 10, 2
bx, by = pyramid.block_grid(wgs_box, block_zoom, block_tiles)[1]
box = pyramid.block_box(bx, by, block_zoom, block_tiles)
side = block_tiles * pyramid.KACHEL
bands = fine_layers.raster_block(box, side, work, [layer])
with rasterio.open(bands) as src:
    shares = src.read(1)
golden["blockCut"] = {"box": list(box), "side": side, "nodata": -32767.0,
                      "pixel": (box[2] - box[0]) / side,
                      "shape": list(shares.shape),
                      "bytes": base64.b64encode(pyramid.to_byte(shares).tobytes()).decode()}

# coarsen on random tiles with gaps; one child of a parent is missing.
rng = np.random.default_rng(5)
coarse = out / "coarsen"
shutil.rmtree(coarse, ignore_errors=True)
values, weights = coarse / "input" / "value", coarse / "input" / "weight"
children = [(8, 10), (9, 10), (8, 11), (11, 13), (10, 12), (11, 12)]
for x, y in children:
    v = rng.random((256, 256)).astype("float32")
    v[rng.random(v.shape) < 0.4] = np.nan
    code = pyramid.to_byte(v)
    pyramid.write_tile(values, 12, x, y, code)
    pyramid.write_tile(weights, 12, x, y, pyramid.full_weight(code))
shutil.copytree(coarse / "input", coarse / "output")
written = pyramid.coarsen(coarse / "output" / "value", coarse / "output" / "weight", 12, 9)
golden["coarsen"] = {"children": [[12, x, y] for x, y in children],
                     "written": [list(t) for t in written]}

shutil.rmtree(work, ignore_errors=True)
(out / "golden.json").write_text(json.dumps(golden))

"""Write the weather test fixtures and their expected values.

Run in the modell shell from backend-go/internal/pipeline/weather:
    nix develop <modell flake> -c python -I testdata/gen_golden.py testdata
The reference functions come from modell/src/pilze:
  extract_grids.main, extract_grids.build_cell_index, daily_cell_means, weekly,
  merge_weekly.main, build_dataset.add_lags, add_anomalies, region_map.normalwerte,
  input_layers.wochenwetter, dwd_fetch.listing, dwd_fetch.newest_version.
The Go tests read the files that this script writes. They do not run Python.
"""
import json
import os
import shutil
import sys
import tempfile
import types
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr
from pyproj import Transformer

OUT = Path(sys.argv[1]).resolve()
PILZE = Path(__file__).resolve().parents[5] / "modell" / "src" / "pilze"
sys.path.insert(0, str(PILZE))

# input_layers and region_map import rasterio at module level; the functions used here do not need it.
for name in ("rasterio", "rasterio.transform"):
    stub = types.ModuleType(name)
    stub.from_origin = lambda *a, **k: None
    sys.modules[name] = stub

import build_dataset  # noqa: E402
import dwd_fetch  # noqa: E402
import extract_grids as eg  # noqa: E402
import merge_weekly  # noqa: E402

rng = np.random.default_rng(20261008)


def num(v):
    v = float(v)
    return None if np.isnan(v) else v


def num32(v):
    """A value as its shortest float32 text; the derive tests compare with a tolerance of 1e-4."""
    v = float(v)
    return None if np.isnan(v) else float(str(np.float32(v)))


# ---------------------------------------------------------------- netCDF fixtures
HX = 4_102_500.0 + 1000.0 * np.arange(12)
HY = 3_008_500.0 - 1000.0 * np.arange(9)
DAYS = {2020: pd.date_range("2020-12-14", "2020-12-31", freq="D"),
        2021: pd.date_range("2021-01-01", "2021-01-24", freq="D")}
TIME_ENC = {"units": "days since 1951-01-01", "calendar": "standard", "dtype": "float64"}


def hyras_values(short, days, shift):
    shape = (len(days), len(HY), len(HX))
    base = {"pr": rng.gamma(0.8, 5.0, shape), "tas": rng.normal(2, 4, shape),
            "tasmin": rng.normal(0, 4, shape), "tasmax": rng.normal(24, 3, shape),
            "hurs": rng.uniform(50, 100, shape)}[short] + shift
    base[rng.uniform(size=shape) < 0.04] = np.nan
    # Not land: no value on the first day, so these pixels define no cell.
    if days[0].year == 2020:
        base[0, 4:, 8:] = np.nan
    if short == "pr" and days[0].year == 2021:
        week2 = (days >= "2021-01-11") & (days <= "2021-01-17")
        base[np.ix_(week2, np.arange(0, 4), np.arange(0, 3))] = np.nan
    return base


def write_hyras(root, folder, short, year, shift=0.0):
    days = DAYS[year]
    vals = hyras_values(short, days, shift)
    enc = {"pr": {"dtype": "float32", "_FillValue": np.float32(-999.0), "zlib": True},
           "tas": {"dtype": "int16", "scale_factor": np.float32(0.01), "_FillValue": np.int16(-32768)},
           "tasmin": {"dtype": "float32", "_FillValue": np.float32(-999.0)},
           "tasmax": {"dtype": "float32", "_FillValue": np.float32(-999.0)},
           "hurs": {"dtype": "int16", "scale_factor": 0.1, "_FillValue": np.int16(-1)}}[short]
    ds = xr.Dataset({short: (("time", "y", "x"), vals)},
                    coords={"time": days, "x": ("x", HX), "y": ("y", HY)})
    path = root / "hyras" / folder / f"{short}_hyras_1_{year}_v6-0_de.nc"
    path.parent.mkdir(parents=True, exist_ok=True)
    ds.to_netcdf(path, format="NETCDF4", encoding={short: enc, "time": TIME_ENC})


to_gk = Transformer.from_crs("EPSG:3035", "EPSG:31467", always_xy=True)
cx, cy = to_gk.transform(HX.mean(), HY.mean())
SX = np.round(cx / 500) * 500 - 7000 + 1000.0 * np.arange(14)
SY = np.round(cy / 500) * 500 + 5500 - 1000.0 * np.arange(12)
SX = SX + 250.0  # keep the pixel centres away from the cell edges
SY = SY + 250.0


def write_soil(root, tree, year, shift=0.0):
    days = DAYS[year]
    shape = (len(days), len(SY), len(SX))
    vals = (rng.uniform(20, 180, shape) + shift).astype(np.float32)
    vals[rng.uniform(size=shape) < 0.04] = np.nan
    ds = xr.Dataset({"paws": (("time", "y", "x"), vals)},
                    coords={"time": days, "x": ("x", SX), "y": ("y", SY)})
    path = root / "soil_moisture" / tree / f"grids_germany_daily_soil_moisture_{tree}_{year}_0-30_v1-0.nc"
    path.parent.mkdir(parents=True, exist_ok=True)
    ds.to_netcdf(path, format="NETCDF4", encoding={"paws": {"_FillValue": None,
                                                           "missing_value": np.float32(-9999.0)},
                                                  "time": TIME_ENC})


raw = OUT / "raw"
raw2 = OUT / "raw2"
for d in (raw, raw2):
    shutil.rmtree(d, ignore_errors=True)
for folder, short, _ in eg.HYRAS_VARS:
    for year in (2020, 2021):
        write_hyras(raw, folder, short, year)
for tree in eg.TREE_SPECIES:
    for year in (2020, 2021):
        write_soil(raw, tree, year)
# The refresh run sees changed 2021 files for these two variables.
write_hyras(raw2, "precipitation", "pr", 2021, shift=1.0)
write_soil(raw2, "spruce", 2021, shift=5.0)


# ---------------------------------------------------------------- extraction
def workdir(trees):
    tmp = Path(tempfile.mkdtemp())
    target = tmp / "data" / "raw" / "dwd"
    for tree in trees:
        shutil.copytree(tree, target, dirs_exist_ok=True)
    return tmp


def run_main(tmp, *extra):
    old = os.getcwd()
    os.chdir(tmp)
    try:
        sys.argv = ["extract_grids.py", "--start", "2020", "--end", "2021",
                    "--out", "data/interim/weather_weekly.parquet", *extra]
        eg.main()
    finally:
        os.chdir(old)


def frame_rows(frame, name):
    frame = frame.sort_values(["iso_year", "iso_week", "cell"]).reset_index(drop=True)
    return [[int(a), int(b), str(c), num(v)] for a, b, c, v in
            zip(frame["iso_year"], frame["iso_week"], frame["cell"], frame[name])]


def checkpoints(tmp):
    out = {}
    for path in sorted((tmp / "data" / "interim" / "weekly").glob("*.parquet")):
        out[path.stem] = frame_rows(pd.read_parquet(path), path.stem)
    return out


def fixed_reference(tmp):
    """One weekly reduction over the days of both files, and NaN for a sum without a value."""
    old = os.getcwd()
    os.chdir(tmp)
    try:
        cells, lookup = eg.build_cell_index(2020)
        n = len(cells)
        ref = xr.open_dataset(sorted(Path("data/raw/dwd/hyras/precipitation").glob("*_2020_*.nc"))[-1])
        hyras_map = eg.flat_map(*eg.pixel_cells(ref.x.values, ref.y.values, None), lookup, n)
        sref = xr.open_dataset(sorted(Path("data/raw/dwd/soil_moisture/spruce").glob("*_2020_*.nc"))[-1])
        to_model = Transformer.from_crs(eg.SOIL_CRS, eg.MODEL_CRS, always_xy=True)
        soil_map = eg.flat_map(*eg.pixel_cells(sref.x.values, sref.y.values, to_model), lookup, n)
        jobs = [(f"data/raw/dwd/hyras/{f}", v, h, hyras_map, v, None, None) for f, v, h in eg.HYRAS_VARS]
        jobs += [(f"data/raw/dwd/soil_moisture/{t}", "paws", "mean", soil_map, f"paws_{t}", None, to_model)
                 for t in eg.TREE_SPECIES]
        jobs += [(f"data/raw/dwd/hyras/{f}", v, h, hyras_map, nm, b(), None) for f, v, h, nm, b in eg.HYRAS_TAGE]
        out = {}
        for folder, var, how, mapping, name, measure, tr in jobs:
            parts, dates = [], []
            for year in (2020, 2021):
                path = sorted(Path(folder).glob(f"*_{year}_*.nc"))[-1]
                daily, d = eg.daily_cell_means(str(path), var, mapping, n, lookup, tr)
                parts.append(measure(daily) if measure else daily)
                dates.append(d)
            daily = np.concatenate(parts)
            dates = dates[0].append(dates[1])
            frame = eg.weekly(daily, dates, how, cells, name)
            if how == "sum":
                count = eg.weekly(np.isfinite(daily).astype("float32"), dates, "sum", cells, name)
                frame.loc[count[name].to_numpy() == 0, name] = np.nan
            out[name] = frame_rows(frame, name)
        return out
    finally:
        os.chdir(old)


tmp1 = workdir([raw])
run_main(tmp1)
main1 = checkpoints(tmp1)
fixed1 = fixed_reference(tmp1)
py_weekly = OUT / "py_weekly"
shutil.rmtree(py_weekly, ignore_errors=True)
shutil.copytree(tmp1 / "data" / "interim" / "weekly", py_weekly)

# merge_weekly.main on the checkpoints of the first run.
old = os.getcwd()
os.chdir(tmp1)
sys.argv = ["merge_weekly.py", "--dir", "data/interim/weekly", "--out", "merged.parquet"]
merge_weekly.main()
os.chdir(old)
merged = pd.read_parquet(tmp1 / "merged.parquet")
merged_json = {"columns": list(merged.columns),
               "dtypes": {c: str(merged[c].dtype) for c in merged.columns},
               "rows": [[num(v) if isinstance(v, (float, np.floating)) else
                         (str(v) if isinstance(v, str) else int(v)) for v in row]
                        for row in merged.itertuples(index=False)]}

tmp2 = workdir([raw, raw2])
shutil.copytree(tmp1 / "data" / "interim" / "weekly", tmp2 / "data" / "interim" / "weekly")
run_main(tmp2, "--refresh-from", "2021")
main2 = checkpoints(tmp2)
fixed2 = fixed_reference(tmp2)
fixed_refresh = {name: [r for r in fixed1[name] if r[0] < 2021] + [r for r in fixed2[name] if r[0] >= 2021]
                 for name in fixed1}

(OUT / "extract.json").write_text(json.dumps({
    "main": main1, "fixed": fixed1, "refreshMain": main2, "refreshFixed": fixed_refresh,
    "checkpointDtypes": {c: str(t) for c, t in pd.read_parquet(py_weekly / "pr.parquet").dtypes.items()},
}))
(OUT / "merged.json").write_text(json.dumps(merged_json))

# ---------------------------------------------------------------- derived features
cells = [f"{4000 + i % 6}_{3000 + i // 6}" for i in range(30)]
monday = pd.Timestamp.fromisocalendar(2019, 40, 1)
weeks = [(monday + pd.Timedelta(weeks=k)).isocalendar() for k in range(120)]
weeks = [(int(w[0]), int(w[1])) for w in weeks]
names = ["pr", "tas", "tasmin", "tasmax", "hurs", "days_since_rain", "frost_days", "heat_days",
         "paws_spruce", "paws_beech", "paws_oak", "paws_pine"]
shape = (len(weeks), len(cells))
values = {
    "pr": rng.gamma(1.2, 10, shape), "tas": rng.normal(9, 6, shape), "tasmin": rng.normal(3, 6, shape),
    "tasmax": rng.normal(15, 7, shape), "hurs": rng.uniform(50, 100, shape),
    "days_since_rain": rng.integers(0, 60, shape).astype(float), "frost_days": rng.integers(0, 8, shape).astype(float),
    "heat_days": rng.integers(0, 8, shape).astype(float),
}
for p in ("paws_spruce", "paws_beech", "paws_oak", "paws_pine"):
    values[p] = rng.uniform(10, 200, shape)
for k in names:
    values[k] = values[k].astype(np.float32)
    values[k][rng.uniform(size=shape) < 0.03] = np.nan
values["paws_oak"][:, 3] = np.nan

long = pd.DataFrame({
    "cell": np.tile(cells, len(weeks)),
    "iso_year": np.repeat([w[0] for w in weeks], len(cells)).astype("int16"),
    "iso_week": np.repeat([w[1] for w in weeks], len(cells)).astype("int8"),
    **{k: values[k].ravel() for k in names},
})
lag_names = [c for c in build_dataset.add_lags(long.assign(week_id=build_dataset.week_number(long))).columns
             if c not in long.columns and c != "week_id"]
anom_names = [f"{v}_anom" for v in build_dataset.ANOMALY_VARS]


def by_key(frame, cols):
    key = {(c, int(y), int(w)): i for i, (c, y, w) in
           enumerate(zip(frame["cell"].astype(str), frame["iso_year"], frame["iso_week"]))}
    out = {}
    for col in cols:
        vals = frame[col].to_numpy()
        out[col] = [[num32(vals[key[(c, y, w)]]) if (c, y, w) in key else None for c in cells]
                    for y, w in OUTWEEKS]
    return out


# visit_model.py: add_anomalies(add_lags(weather)) over the whole record.
w = long.copy()
w["week_id"] = build_dataset.week_number(w)
full = build_dataset.add_anomalies(build_dataset.add_lags(w))
OUTWEEKS = weeks
derive_full = by_key(full, lag_names + anom_names)

# region_map.py: two forecast weeks, normals over everything, lags on the last weeks + 20.
import region_map  # noqa: E402

weather = long[["cell", "iso_year", "iso_week", "pr", "tas", "tasmin"]].copy()
weather["week_id"] = build_dataset.week_number(weather)
last = weather["week_id"].max()
letzte = weather[weather["week_id"] == last].iloc[0]
mon = pd.Timestamp.fromisocalendar(int(letzte["iso_year"]), int(letzte["iso_week"]), 1)
future = []
for step in (1, 2):
    block = weather[weather["week_id"] == last][["cell"]].copy()
    kal = (mon + pd.Timedelta(weeks=step)).isocalendar()
    block["iso_year"], block["iso_week"] = int(kal[0]), int(kal[1])
    block["week_id"] = build_dataset.week_number(block)
    future.append(block)
weather = pd.concat([weather, *future], ignore_index=True)
weather["cell"] = weather["cell"].astype("category")
normale = region_map.normalwerte(weather)
RENDER_WEEKS = 60
grenze = int(weather["week_id"].max()) - (RENDER_WEEKS + 20)
weather = weather[weather["week_id"] > grenze].copy()
weather = build_dataset.add_lags(weather)
weather = weather.merge(normale, on=["cell", "iso_week"], how="left")
for var in ("pr_sum4", "pr_sum8", "tas"):
    weather[f"{var}_anom"] = weather[var] - weather[f"{var}_normal"]
fweeks = sorted({(int(y), int(k)) for y, k in zip(weather["iso_year"], weather["iso_week"])})
OUTWEEKS = fweeks
derive_forecast = by_key(weather, lag_names + anom_names)

# input_layers.py: paws mean, tas_mittel, pr_sum and pr_sum4_anom.
import input_layers  # noqa: E402

wpath = Path(tempfile.mkdtemp()) / "weather_weekly.parquet"
long.to_parquet(wpath, index=False)
layers, lweeks = input_layers.wochenwetter(wpath, set(cells), 1000)
OUTWEEKS = weeks
derive_layers = by_key(layers, ["paws", "pr_sum2", "pr_sum4", "pr_sum8", "tas_mittel2", "tas_mittel4",
                                "pr_sum4_anom"])

import gzip  # noqa: E402

(OUT / "derive.json.gz").write_bytes(gzip.compress(json.dumps({
    "cells": cells, "weeks": weeks,
    "input": {k: [[num(v) for v in row] for row in values[k]] for k in names},
    "lagNames": lag_names, "anomNames": anom_names,
    "full": derive_full,
    "forecast": {"renderWeeks": RENDER_WEEKS, "grenze": grenze, "weeks": fweeks, "values": derive_forecast},
    "layers": derive_layers,
}).encode(), mtime=0))

# ---------------------------------------------------------------- listings
LISTINGS = {
    "hyras_precipitation.html": ["pr", 2024],
    "soil_spruce_2024.html": ["spruce", 2024],
}
hyras_html = """<html><head><title>Index of /hyras_de/precipitation/</title></head><body>
<h1>Index of /climate_environment/CDC/grids_germany/daily/hyras_de/precipitation/</h1><hr><pre>
<a href="../">../</a>
<a href="?C=N;O=D">Name</a>
<a href="BESCHREIBUNG_gridsgermany_daily_hyras_de_precipitation_de.pdf">BESCHREIBUNG...</a> 05-Mar-2025 10:00  512k
<a href="pr_hyras_1_2023_v6-0_de.nc">pr_hyras_1_2023_v6-0_de.nc</a> 12-Feb-2025 09:15  412M
<a href="pr_hyras_1_2024_v5-0_de.nc">pr_hyras_1_2024_v5-0_de.nc</a> 12-Feb-2025 09:15  412M
<a href="pr_hyras_1_2024_v6-1_de.nc">pr_hyras_1_2024_v6-1_de.nc</a> 12-Feb-2025 09:15  412M
<a href="pr_hyras_1_2024_v6-0_de.nc">pr_hyras_1_2024_v6-0_de.nc</a> 12-Feb-2025 09:15  412M
<a href="pr_hyras_5_2024_v6-0_de.nc">pr_hyras_5_2024_v6-0_de.nc</a> 12-Feb-2025 09:15  20M
<a href="pr_hyras_1_2025_v6-0_de.nc">pr_hyras_1_2025_v6-0_de.nc</a> 02-Oct-2026 08:00  300M
<a href="pr_hyras_1_2025_v6-0_de.nc.md5">pr_hyras_1_2025_v6-0_de.nc.md5</a> 02-Oct-2026 08:00  1k
</pre><hr></body></html>
"""
soil_html = """<html><body><pre><a href="../">../</a>
<a href="grids_germany_daily_soil_moisture_spruce_2024_0-30_v1-0.nc">a</a>
<a href="grids_germany_daily_soil_moisture_spruce_2024_0-30_v1-1.nc">b</a>
<a href="grids_germany_daily_soil_moisture_spruce_2024_0-10_v1-2.nc">c</a>
<a href="grids_germany_daily_soil_moisture_spruce_2024_30-60_v1-0.nc">d</a>
</pre></body></html>
"""
listing_out = {}
for fname, html in (("hyras_precipitation.html", hyras_html), ("soil_spruce_2024.html", soil_html)):
    (OUT / fname).write_text(html)

    class Resp:
        def __init__(self, body):
            self.body = body.encode()

        def read(self):
            return self.body

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    dwd_fetch.urllib.request.urlopen = lambda req, timeout=0, _h=html: Resp(_h)
    names = dwd_fetch.listing("http://example/")
    entry = {"names": names}
    if fname.startswith("hyras"):
        entry["newest"] = {str(y): dwd_fetch.newest_version(names, rf"pr_hyras_\d+_{y}_v[\d-]+_de\.nc")
                           for y in (2023, 2024, 2025, 2026)}
    else:
        entry["newest"] = {"0-30": dwd_fetch.newest_version(
            names, r"grids_germany_daily_soil_moisture_spruce_2024_0\-30_v[\d-]+\.nc")}
    listing_out[fname] = entry
(OUT / "listing.json").write_text(json.dumps(listing_out, indent=1))
print("ok")

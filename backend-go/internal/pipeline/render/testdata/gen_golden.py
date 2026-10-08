"""Make the golden fixtures of package render.

Runs region_map.main and input_layers.main (modell/src/pilze) on a small
synthetic region and copies inputs and outputs into testdata/golden.
Run it in the geo shell of modell:

    cd modell && nix develop .#geo -c python \
        ../backend-go/internal/pipeline/render/testdata/gen_golden.py
"""

from __future__ import annotations

import json
import math
import os
import pickle
import shutil
import sys
import tempfile
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from pyproj import Transformer
from sklearn.isotonic import IsotonicRegression

HERE = Path(__file__).resolve().parent
SRC = HERE.parents[4] / "modell" / "src" / "pilze"
OUT = HERE / "golden"
sys.path.insert(0, str(SRC))

REGION = (9.40, 51.25, 9.60, 51.35)
STEP = 500
SLUG = "steinpilz-test"
TAXA = ["Boletus edulis"]
WEEKS, FORECAST, LAYER_WEEKS = 4, 2, 3
VARS = ["pr", "tas", "tasmin", "tasmax", "hurs", "paws_spruce", "paws_beech",
        "paws_oak", "paws_pine", "days_since_rain", "frost_days", "heat_days"]
rng = np.random.default_rng(7)


def grid_tables():
    to_model = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True)
    x0, y0 = to_model.transform(REGION[0], REGION[1])
    x1, y1 = to_model.transform(REGION[2], REGION[3])
    b = [int(v // STEP * STEP) for v in (x0, y0, x1, y1)]
    ny, nx = (b[3] - b[1]) // STEP, (b[2] - b[0]) // STEP
    gy, gx = np.mgrid[0:ny, 0:nx]
    x = b[0] + (gx.ravel() + 0.5) * STEP
    y = b[3] - (gy.ravel() + 0.5) * STEP
    forest = rng.uniform(-0.1, 1.0, x.size).clip(0, 1).astype("float32")
    trees = pd.DataFrame({"gx": gx.ravel(), "gy": gy.ravel(), "x": x, "y": y,
                          "forest_fraction": forest,
                          "forest_pixels": forest * 2500,
                          "cell": [f"{int(a // STEP)}_{int(c // STEP)}" for a, c in zip(x, y)]})
    fine = trees["cell"]
    scales = pd.DataFrame({"cell": fine, "x": x, "y": y,
                           "forest_fraction_500m": forest,
                           "forest_fraction_1km": rng.uniform(0, 1, x.size).astype("float32"),
                           "tree_spruce_1km": rng.uniform(0, 1, x.size).astype("float32"),
                           "tree_beech_2km": rng.uniform(0, 1, x.size).astype("float32")})
    scales = scales.drop(index=rng.choice(x.size, 5, replace=False)).reset_index(drop=True)
    ph = rng.uniform(3.5, 7.5, x.size)
    ph[rng.choice(x.size, 12, replace=False)] = np.nan
    site = pd.DataFrame({"cell": fine, "soil_phh2o_0_5cm": ph,
                         "dem_relief": rng.uniform(0, 80, x.size)})
    site = site.drop(index=rng.choice(x.size, 4, replace=False)).reset_index(drop=True)
    return trees, scales, site


def weather_table(cells):
    weeks = []
    monday = pd.Timestamp.fromisocalendar(2023, 1, 1)
    while True:
        k = monday.isocalendar()
        weeks.append((int(k[0]), int(k[1])))
        if weeks[-1] == (2025, 30):
            break
        monday += pd.Timedelta(weeks=1)
    rows = []
    for ci, cell in enumerate(cells):
        for wi, (yr, wk) in enumerate(weeks):
            season = math.sin(2 * math.pi * (wk - 10) / 52)
            tas = 9 + 10 * season + rng.normal(0, 2) + 0.1 * ci
            rows.append({"iso_year": yr, "iso_week": wk, "cell": cell,
                         "pr": max(0.0, rng.gamma(1.5, 10)),
                         "tas": tas, "tasmin": tas - rng.uniform(3, 8),
                         "tasmax": tas + rng.uniform(3, 8), "hurs": rng.uniform(55, 95),
                         "paws_spruce": rng.uniform(20, 100), "paws_beech": rng.uniform(20, 100),
                         "paws_oak": rng.uniform(20, 100), "paws_pine": rng.uniform(20, 100),
                         "days_since_rain": float(rng.integers(0, 30)),
                         "frost_days": float(rng.integers(0, 8)) if season < 0 else 0.0,
                         "heat_days": float(rng.integers(0, 8)) if season > 0.6 else 0.0})
    w = pd.DataFrame(rows)
    w["iso_year"] = w["iso_year"].astype("int16")
    w["iso_week"] = w["iso_week"].astype("int8")
    for v in VARS:
        w[v] = w[v].astype("float32")
    w["cell"] = w["cell"].astype("category")
    return w.sort_values(["iso_year", "iso_week", "cell"]).reset_index(drop=True)


def occurrences(trees):
    n = 3000
    x = rng.uniform(trees["x"].min() - 40_000, trees["x"].max() + 40_000, n)
    y = rng.uniform(trees["y"].min() - 40_000, trees["y"].max() + 40_000, n)
    day = pd.Timestamp("2023-01-01") + pd.to_timedelta(rng.integers(0, 940, n), unit="D")
    species = rng.choice(TAXA + ["Amanita muscaria", "Russula sp", "Xerocomus badius"], n,
                         p=[0.2, 0.3, 0.3, 0.2])
    who = rng.choice([f"obs{i:03d}" for i in range(120)], n)
    return pd.DataFrame({"recordedByHash": who, "x": x, "y": y, "date": day.normalize(),
                         "species": species})


FEATURES = {
    0: ["n_species", "n_records", "iso_week", "week_sin", "week_cos", "pr_lag0", "tas_lag1",
        "tasmin_lag2", "pr_sum4", "tas_mean2", "tas_drop_2w", "pr_sum4_anom", "tas_anom",
        "forest_fraction_500m", "tree_spruce_1km", "tree_beech_2km", "soil_phh2o_0_5cm",
        "activity_rate_7d", "activity_rate_14d", "activity_rate_21d", "unknown_column",
        "prior_rate_cell", "prior_n_cell", "prior_rate_block", "prior_n_block"],
    1: ["n_species", "week_sin", "week_cos", "pr_lag1", "tas_lag2", "pr_sum8_anom",
        "tasmin_mean4", "forest_fraction_500m", "tree_beech_2km", "activity_rate_7d_h1",
        "activity_rate_21d_h1", "prior_rate_cell", "prior_n_block"],
    2: ["iso_week", "week_cos", "pr_lag2", "tas_lag3", "tasmin_lag4", "pr_sum8",
        "forest_fraction_500m", "tree_spruce_1km", "activity_rate_14d_h2", "prior_rate_block",
        "prior_n_cell"],
}
RANGES = {"pr": (0, 50), "tas": (-5, 25), "tasmin": (-10, 15), "pr_sum4": (0, 150),
          "pr_sum8": (0, 300), "tas_mean2": (-5, 25), "tasmin_mean4": (-10, 15),
          "tas_drop_2w": (-8, 8), "pr_sum4_anom": (-60, 60), "pr_sum8_anom": (-90, 90),
          "tas_anom": (-6, 6), "iso_week": (1, 52), "week_sin": (-1, 1), "week_cos": (-1, 1),
          "activity": (0, 0.6), "prior_rate": (0, 1), "prior_n": (0, 40), "soil": (3.5, 7.5)}


def value_range(name):
    for key in ("activity", "prior_rate", "prior_n", "soil"):
        if name.startswith(key) or (key == "soil" and name.startswith("soil")):
            return RANGES[key]
    base = name.split("_lag")[0]
    return RANGES.get(name, RANGES.get(base, (0, 1)))


def train_bundle():
    horizons = {}
    for h, feats in FEATURES.items():
        n = 4000
        X = np.column_stack([rng.uniform(*value_range(f), n) for f in feats])
        score = np.zeros(n)
        for j, f in enumerate(feats):
            lo, hi = value_range(f)
            z = (X[:, j] - lo) / (hi - lo) - 0.5
            weight = {"forest_fraction_500m": 3.0, "iso_week": 1.5, "week_sin": -2.0}.get(f, 1.0)
            if f.startswith(("tas", "pr", "activity")):
                weight = 2.0
            score += weight * z
        y = (rng.uniform(0, 1, n) < 1 / (1 + np.exp(-score))).astype(int)
        params = {"objective": "binary", "num_leaves": 15, "min_data_in_leaf": 20,
                  "learning_rate": 0.1, "verbosity": -1, "num_threads": 1,
                  "deterministic": True}
        booster = lgb.train(params, lgb.Dataset(X[:3000], y[:3000], feature_name=feats), 40)
        raw = booster.predict(X[3000:])
        iso = IsotonicRegression(out_of_bounds="clip").fit(raw, y[3000:])
        horizons[h] = {"model": booster, "isotonic": iso, "ceiling": [0.62, 0.55, 0.58][h],
                       "features": feats, "params": params, "rounds": 40}
    return horizons


def prior_tables(trees):
    cells = sorted({f"{int(a // 5000)}_{int(b // 5000)}" for a, b in zip(trees["x"], trees["y"])})
    blocks = sorted({f"{int(a // 25000)}_{int(b // 25000)}" for a, b in zip(trees["x"], trees["y"])})
    cell = pd.DataFrame({"cell": cells[:-2], "rate": rng.uniform(0, 0.5, len(cells) - 2),
                         "n": rng.integers(1, 40, len(cells) - 2).astype(float)})
    block = pd.DataFrame({"block": blocks, "rate": rng.uniform(0, 0.5, len(blocks)),
                          "n": rng.integers(1, 200, len(blocks)).astype(float)})
    return cell, block


def go_bundle(path: Path, horizons, cell, block):
    path.mkdir(parents=True, exist_ok=True)
    out = {"format": 1, "label": "boletus_edulis", "species": TAXA, "slug": SLUG,
           "horizons": {}, "prior": {}, "trainedAt": "", "visits": 0, "positives": 0}
    for h, hz in horizons.items():
        (path / f"h{h}.txt").write_text(hz["model"].model_to_string())
        iso = hz["isotonic"]
        out["horizons"][str(h)] = {
            "model": f"h{h}.txt", "features": hz["model"].feature_name(),
            "ceiling": hz["ceiling"], "rounds": hz["rounds"], "params": hz["params"],
            "isotonic": {"x": [float(v) for v in iso.X_thresholds_],
                         "y": [float(v) for v in iso.y_thresholds_],
                         "xMin": float(iso.X_min_), "xMax": float(iso.X_max_),
                         "increasing": True, "outOfBounds": "clip"}}
    for key, df in (("cell", cell), ("block", block)):
        out["prior"][key] = {"keys": list(df[key]), "rate": [float(v) for v in df["rate"]],
                             "n": [float(v) for v in df["n"]]}
    (path / "bundle.json").write_text(json.dumps(out))


OLD_LAYERS = {
    "bounds": [[51.0, 9.0], [52.0, 10.0]],
    "layers": {
        "relief": {"label": "Höhenunterschied in der Zelle", "unit": "m", "static": True,
                   "low": 1e-05, "high": 151.9, "histogram": {"classes": [0.0, 0.5, 1.0],
                                                               "shares": [0.25, 0.75]},
                   "tiles": "layers_kacheln/relief", "zooms": [5, 9],
                   "have": {"5": ["16/10"], "9": ["270/170", "271/170"]}},
        "regen": {"label": "alt", "unit": "mm", "static": False, "weeks": ["2020W01"]},
        "wald": {"label": "Wald", "note": "Thünen", "unit": "%", "static": True, "low": 0,
                 "high": 100, "tiles": "layers_kacheln/wald", "zooms": [5, 13],
                 "haveZoom": 10, "offlineZoomTo": 12, "have": {}},
    },
}


def main() -> None:
    work = Path(tempfile.mkdtemp(prefix="render-golden-"))
    interim = work / "data" / "interim"; interim.mkdir(parents=True)
    trees, scales, site = grid_tables()
    trees.to_parquet(interim / "trees_de_500m.parquet", index=False)
    scales.to_parquet(interim / "tree_scales.parquet", index=False)
    site.to_parquet(interim / "site_500m.parquet", index=False)
    cells = sorted({f"{int(a // 5000)}_{int(b // 5000)}" for a, b in zip(trees["x"], trees["y"])})
    abroad = cells[1]
    weather = weather_table([c for c in cells if c != abroad])
    weather.to_parquet(interim / "weather_weekly.parquet", index=False)
    occ = occurrences(trees)
    occ.to_parquet(interim / "occurrences.parquet", index=False)
    horizons = train_bundle()
    cell, block = prior_tables(trees)
    (work / "models").mkdir()
    with (work / "models" / "test.pkl").open("wb") as f:
        pickle.dump({"label": "boletus_edulis", "species": TAXA,
                     "prior": {"cell": cell, "block": block}, "horizons": horizons}, f)

    import region_map
    import input_layers
    region_map.REGIONEN["tt"] = REGION
    out = work / "out"; out.mkdir()
    dump = work / "dump"; dump.mkdir()
    os.chdir(work)
    os.environ["PILZE_DUMP"] = str(dump)
    sys.argv = ["region_map.py", "--model", "models/test.pkl", "--name", SLUG, "--region", "tt",
                "--weeks", str(WEEKS), "--forecast", str(FORECAST), "--tiles", "--no-image",
                "--out", "out"]
    region_map.main()
    (out / "layers.json").write_text(json.dumps(OLD_LAYERS, indent=1))
    sys.argv = ["input_layers.py", "--only-weekly", "--tiles", "--no-image",
                "--weeks", str(LAYER_WEEKS), "--out", "out"]
    input_layers.main()

    shutil.rmtree(OUT, ignore_errors=True)
    (OUT / "input").mkdir(parents=True)
    for name in ("trees_de_500m", "tree_scales", "site_500m"):
        shutil.copy(interim / f"{name}.parquet", OUT / "input" / f"{name}.parquet")
    go_bundle(OUT / "input" / "bundle", horizons, cell, block)
    weeks = weather[["iso_year", "iso_week"]].drop_duplicates()
    wcells = sorted(weather["cell"].astype(str).unique())
    w = weather.assign(cell=weather["cell"].astype(str)).set_index(["iso_year", "iso_week", "cell"])
    vars_ = {}
    for v in VARS:
        col = []
        for yr, wk in weeks.itertuples(index=False):
            for c in wcells:
                col.append(float(w.loc[(yr, wk, c), v]))
        vars_[v] = col
    (OUT / "input" / "weather.json").write_text(json.dumps(
        {"cells": wcells, "weeks": [[int(a), int(b)] for a, b in weeks.itertuples(index=False)],
         "vars": vars_}))
    (OUT / "input" / "records.json").write_text(json.dumps(
        [{"x": float(r.x), "y": float(r.y), "date": r.date.strftime("%Y-%m-%d"),
          "species": r.species, "observer": r.recordedByHash} for r in occ.itertuples()]))
    (OUT / "input" / "old_layers.json").write_text(json.dumps(OLD_LAYERS, indent=1))
    shutil.copytree(out, OUT / "maps", ignore=shutil.ignore_patterns("_work_*", "layers", "*_weeks"))
    dumps = sorted(dump.glob("dump_*.parquet"))
    frames = [pd.read_parquet(p).assign(week=p.stem[5:]) for p in dumps]
    pd.concat(frames).to_parquet(OUT / "dump.parquet", index=False)
    print("golden written to", OUT)


if __name__ == "__main__":
    main()

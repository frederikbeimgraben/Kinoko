"""Write the golden files of internal/pipeline/model/fit.

Run it in the default modell nix shell (it needs lightgbm, sklearn and pyproj):
    cd modell && nix develop . -c python ../backend-go/internal/pipeline/model/fit/testdata/gen_golden.py

The data is synthetic. The script writes the inputs as parquet, runs visit_model.main --quick
--save-prepared and final_model.main on them unchanged, and stores what they produce.
The LightGBM settings get num_threads=1, deterministic=True and force_col_wise=True,
so the Go run with the same settings trains the same trees.
"""

from __future__ import annotations

import contextlib
import io
import json
import math
import pickle
import re
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
from pyproj import Transformer

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[5]
sys.path.insert(0, str(ROOT / "modell" / "src" / "pilze"))
import final_model as fm  # noqa: E402
import visit_model as vm  # noqa: E402

TAXA = ["Testus primus", "Testus secundus"]
OTHERS = [f"Otherus sp{i:02d}" for i in range(40)]
X0, X1 = 4_180_000, 4_220_000  # two 100 km bands: two space folds
Y0, Y1 = 3_000_000, 3_015_000
FIRST, LAST = 2016, 2023
VISIT_YEARS = (2020, 2021, 2022, 2023)
EXTRA = dict(num_threads=1, deterministic=True, force_col_wise=True)
HORIZONS = "0,2"


def nulls(a) -> list:
    return [None if (isinstance(v, float) and math.isnan(v)) else v
            for v in np.asarray(a, dtype=float).ravel().tolist()]


def quarter(v):
    """Values on a 0.25 grid: their sums and means of 2, 4 and 8 are exact in float32."""
    return (np.round(np.asarray(v) * 4) / 4).astype("float32")


def weather_table(rng) -> pd.DataFrame:
    mondays = pd.date_range(f"{FIRST}-01-04", f"{LAST}-12-25", freq="W-MON")
    weeks = [(int(d.isocalendar()[0]), int(d.isocalendar()[1])) for d in mondays]
    cells = [f"{cx}_{cy}" for cx in range(X0 // 5000, X1 // 5000) for cy in range(Y0 // 5000, Y1 // 5000)]
    rows = []
    for year, week in weeks:
        season = 10 - 10 * math.cos(2 * math.pi * week / 52)
        for cell in cells:
            rows.append((year, week, cell, season))
    frame = pd.DataFrame(rows, columns=["iso_year", "iso_week", "cell", "season"])
    n = len(frame)
    frame["pr"] = quarter(rng.gamma(1.5, 6.0, n))
    frame["tas"] = quarter(frame["season"] + rng.normal(0, 3, n))
    frame["tasmin"] = quarter(frame["tas"] - 5 - rng.gamma(2.0, 1.0, n))
    frame["iso_year"] = frame["iso_year"].astype("int16")
    frame["iso_week"] = frame["iso_week"].astype("int8")
    return frame.drop(columns="season")


def tree_table(rng) -> pd.DataFrame:
    gx, gy = np.meshgrid(np.arange(X0 // 500, X1 // 500), np.arange(Y0 // 500, Y1 // 500), indexing="ij")
    gx, gy = gx.ravel(), gy.ravel()
    wave = 0.5 + 0.4 * np.sin(gx / 7.0) * np.cos(gy / 5.0)
    out = pd.DataFrame({"cell": [f"{a}_{b}" for a, b in zip(gx, gy)],
                        "x": gx * 500.0 + 250, "y": gy * 500.0 + 250})
    out["forest_fraction_500m"] = np.clip(wave + rng.normal(0, 0.1, len(gx)), 0, 1).astype("float32")
    out["forest_fraction_2km"] = np.clip(wave, 0, 1).astype("float32")
    out["tree_beech_500m"] = np.clip(1 - wave + rng.normal(0, 0.1, len(gx)), 0, 1).astype("float32")
    out["tree_spruce_500m"] = rng.random(len(gx)).astype("float32")
    out["tree_beech_2km"] = np.clip(1 - wave, 0, 1).astype("float32")
    out["tree_spruce_2km"] = (0.3 + 0.2 * np.cos(gx / 3.0)).astype("float32")
    keep = rng.random(len(out)) > 0.05
    return out[keep].reset_index(drop=True)


def records(rng, weather: pd.DataFrame, trees: pd.DataFrame) -> pd.DataFrame:
    pr = weather.set_index(["cell", "iso_year", "iso_week"])["pr"]
    beech = trees.set_index("cell")["tree_beech_500m"]
    rows = []
    serial = 0

    def add(observer, day, x, y, species, basis="gbif", unc=None):
        nonlocal serial
        serial += 1
        rows.append(dict(gbifID=f"{'app:' if basis == 'app' else ''}{serial}", species=species,
                         recordedByHash=observer, basis=basis, date=day, x=x, y=y,
                         coordinateUncertaintyInMeters=unc))

    for year in VISIT_YEARS:
        for _ in range(190):
            day = pd.Timestamp(year, 4, 1) + pd.Timedelta(days=int(rng.integers(0, 230)))
            observer = f"obs{int(rng.integers(0, 50)):02d}"
            kx = int(rng.integers(X0 // 1000, X1 // 1000))
            ky = int(rng.integers(Y0 // 1000, Y1 // 1000))
            iy, iw, _ = day.isocalendar()
            cell = f"{kx // 5}_{ky // 5}"
            fine = f"{(kx * 1000 + 500) // 500}_{(ky * 1000 + 500) // 500}"
            logit = (-2.6 + 2.2 * math.exp(-((iw - 38) / 6) ** 2) + 1.5 * float(beech.get(fine, 0.5))
                     + 0.06 * (float(pr.get((cell, iy, iw), 8.0)) - 8.0))
            target = rng.random() < 1 / (1 + math.exp(-logit))
            n_species = int(rng.integers(1, 7))
            names = list(rng.choice(OTHERS, size=n_species, replace=False))
            if target:
                names[0] = TAXA[int(rng.integers(0, 2))]
            unc = None if rng.random() < 0.5 else float(rng.choice([10.0, 100.0, 250.0, 2000.0]))
            for name in names:
                x = kx * 1000 + float(rng.uniform(1, 999))
                y = ky * 1000 + float(rng.uniform(1, 999))
                add(observer, day, x, y, name, unc=unc)
                if rng.random() < 0.2:
                    add(observer, day, x + 3, y + 3, name, unc=unc)
        for _ in range(25):
            day = pd.Timestamp(year, 6, 1) + pd.Timedelta(days=int(rng.integers(0, 150)))
            x = float(rng.uniform(X0 + 1, X1 - 1))
            y = float(rng.uniform(Y0 + 1, Y1 - 1))
            name = TAXA[0] if rng.random() < 0.7 else OTHERS[0]
            add(f"app:{serial:016x}", day, x, y, name, basis="app")
        for _ in range(40):
            day = pd.Timestamp(year, 5, 1) + pd.Timedelta(days=int(rng.integers(0, 150)))
            x = float(rng.uniform(X0 + 1, X1 - 1))
            y = float(rng.uniform(Y0 + 1, Y1 - 1))
            add(None, day, x, y, str(rng.choice(TAXA + OTHERS)))
    for _ in range(30):
        day = pd.Timestamp(2014, 7, 1) + pd.Timedelta(days=int(rng.integers(0, 60)))
        add("obs01", day, float(rng.uniform(X0 + 1, X1 - 1)), float(rng.uniform(Y0 + 1, Y1 - 1)), TAXA[0])
    frame = pd.DataFrame(rows)
    frame["date"] = pd.to_datetime(frame["date"]).dt.normalize()
    iso = frame["date"].dt.isocalendar()
    frame["iso_year"] = iso["year"].astype("int16")
    frame["iso_week"] = iso["week"].astype("int8")
    frame["doy"] = frame["date"].dt.dayofyear.astype("int16")
    lon, lat = Transformer.from_crs("EPSG:3035", "EPSG:4326", always_xy=True).transform(
        frame["x"].to_numpy(), frame["y"].to_numpy())
    frame["decimalLongitude"], frame["decimalLatitude"] = lon, lat
    frame["cell_x"] = (frame["x"] // 5000).astype("int32")
    frame["cell_y"] = (frame["y"] // 5000).astype("int32")
    frame["cell"] = frame["cell_x"].astype(str) + "_" + frame["cell_y"].astype(str)
    return frame


def inputs_json(occ: pd.DataFrame, weather: pd.DataFrame, trees: pd.DataFrame) -> dict:
    recs = [dict(gbifID=r.gbifID, species=r.species, observer=r.recordedByHash, basis=r.basis,
                 lat=r.decimalLatitude, lon=r.decimalLongitude,
                 unc=None if pd.isna(r.coordinateUncertaintyInMeters) else r.coordinateUncertaintyInMeters,
                 date=r.date.strftime("%Y-%m-%d"), iso_year=int(r.iso_year), iso_week=int(r.iso_week),
                 doy=int(r.doy), x=r.x, y=r.y, cell=r.cell)
            for r in occ.itertuples()]
    weeks = weather[["iso_year", "iso_week"]].drop_duplicates()
    cells = list(dict.fromkeys(weather["cell"]))
    cube = {v: weather[v].astype(float).tolist() for v in ("pr", "tas", "tasmin")}
    names = [c for c in trees.columns if c not in ("cell", "x", "y")]
    return {"records": recs, "taxa": TAXA,
            "weather": {"cells": cells, "weeks": weeks.to_numpy().tolist(), "vars": cube},
            "trees": {"cells": trees["cell"].tolist(), "columns": names,
                      "values": {c: trees[c].astype(float).tolist() for c in names}}}


def parse_tables(text: str) -> dict:
    """The candidate and settings tables that final_model.main prints, per horizon."""
    out = {}
    for part in text.split("================ horizon ")[1:]:
        h = int(part.split(" ", 1)[0])
        cand = re.findall(r"^\s+(\d+) +([\d.nan]+) +([\d.nan]+) +([\d.nan]+) +([\d.nan]+)", part.split("chosen:")[0], re.M)
        sets = re.findall(r"^(standard|small trees|smoothed|large trees)\s+([\d.]+) +([\d.]+) +([\d.]+) +([\d.]+)",
                          part, re.M)
        brier = re.search(r"Brier score\s+raw ([\d.]+)\s+calibrated ([\d.]+)", part)
        auc = re.search(r"AUC of the calibrated out-of-fold scores: ([\d.]+)", part)
        out[str(h)] = {"candidates": [[int(c[0])] + [float(v) for v in c[1:]] for c in cand],
                       "settings": [[s[0]] + [float(v) for v in s[1:]] for s in sets],
                       "brier": [float(brier.group(1)), float(brier.group(2))], "auc": float(auc.group(1))}
    return out


def setting_name(params: dict, rounds: int) -> str:
    return next(label for label, p, r in fm.GRID if p == params and r == rounds)


def main() -> None:
    rng = np.random.default_rng(20261008)
    weather = weather_table(rng)
    trees = tree_table(rng)
    occ = records(rng, weather, trees)
    (HERE / "inputs.json").write_text(json.dumps(inputs_json(occ, weather, trees)))

    # The settings of final_model.py, changed in place so every reference sees them.
    for _, params, _ in fm.GRID:
        params.update(EXTRA)
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        occ.to_parquet(work / "occ.parquet", index=False)
        weather.to_parquet(work / "weather.parquet", index=False)
        trees.to_parquet(work / "trees.parquet", index=False)
        prepared = work / "visits.parquet"
        sys.argv = ["visit_model.py", "--occurrences", str(work / "occ.parquet"),
                    "--weather", str(work / "weather.parquet"), "--species", ",".join(TAXA),
                    "--tree-scales", str(work / "trees.parquet"), "--save-prepared", str(prepared), "--quick"]
        vm.main()
        sys.argv = ["final_model.py", "--data", str(prepared), "--out", str(work / "models"),
                    "--name", "testus_chain", "--species", ",".join(TAXA), "--horizons", HORIZONS,
                    "--oof", str(work), "--finds", str(work / "funde")]
        printed = io.StringIO()
        with contextlib.redirect_stdout(printed):
            fm.main()
        bundle = pickle.loads((work / "models" / "testus_chain.pkl").read_bytes())
        finds = (work / "funde" / "testus_chain.json").read_text()

        frame = pd.read_parquet(prepared)
        frame["block"] = fm.block_key(frame)
        blocks = json.loads(prepared.with_suffix(".blocks.json").read_text())
        everything = np.arange(len(frame))
        prior_all = fm.prior_columns(frame, everything, np.array([], int))
        design, horizons = {}, {}
        tables = parse_tables(printed.getvalue())
        for h in (int(v) for v in HORIZONS.split(",")):
            features = fm.feature_list(blocks, frame, h)
            design[str(h)] = {"features": features, "x": nulls(fm.design(frame, features, prior_all).to_numpy())}
            hz = bundle["horizons"][h]
            iso = hz["isotonic"]
            x_best = fm.design(frame, hz["features"], prior_all)
            horizons[str(h)] = dict(
                tables[str(h)], features=hz["features"], setting=setting_name(hz["params"], hz["rounds"]),
                rounds=hz["rounds"], ceiling=hz["ceiling"],
                isoX=iso.X_thresholds_.tolist(), isoY=iso.y_thresholds_.tolist(),
                predict=hz["model"].predict(x_best).tolist())
        prior = {k: {"keys": t[k].astype(str).tolist(), "rate": nulls(t["rate"]), "n": t["n"].tolist()}
                 for k, t in bundle["prior"].items()}
        golden = {
            "source": {"table": "visit_model.main --quick --save-prepared",
                       "design": "final_model.feature_list, design, prior_columns(frame, all, [])",
                       "horizons": "final_model.main: printed tables, pickled bundle, Booster.predict",
                       "finds": "final_model.write_finds"},
            "keys": frame["visit"].tolist(), "label": frame["label"].tolist(),
            "blocks": blocks, "design": design, "horizons": horizons, "prior": prior,
            "finds": finds, "visits": len(frame), "positives": int(frame["label"].sum()),
        }
    (HERE / "golden.json").write_text(json.dumps(golden))
    print(printed.getvalue()[-3000:], file=sys.stderr)


if __name__ == "__main__":
    main()

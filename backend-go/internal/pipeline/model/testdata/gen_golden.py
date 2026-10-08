"""Write the golden files of internal/pipeline/model/{lgbm,bundle,train}.

Run it in the modell nix shell from the repository root:
    cd modell && nix develop . -c python ../backend-go/internal/pipeline/model/testdata/gen_golden.py

The data is synthetic. Each section names the Python function that makes the expected values.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import brier_score_loss

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
sys.path.insert(0, str(ROOT / "modell" / "src" / "pilze"))
import final_model as fm  # noqa: E402

NAMES = ["f_normal", "f_uniform", "iso_week", "f_gappy", "f_flag", "f_noise"]
# The Go test trains with the same text; force_col_wise stops the timing-based choice of the histogram layout.
PARAMS = dict(fm.PARAMS, num_threads=1, deterministic=True, force_col_wise=True)
ROUNDS = 60


def nulls(a) -> list:
    return [None if (isinstance(v, float) and math.isnan(v)) else v for v in np.asarray(a, dtype=float).ravel().tolist()]


def synthetic(rng, n: int) -> pd.DataFrame:
    x = np.column_stack([
        rng.normal(size=n),
        rng.uniform(-2, 3, size=n),
        rng.integers(1, 53, size=n).astype(float),
        np.where(rng.random(n) < 0.15, np.nan, rng.normal(1.0, 2.0, size=n)),
        (rng.random(n) < 0.3).astype(float),
        rng.normal(size=n),
    ])
    return pd.DataFrame(x, columns=NAMES)


def lgbm_golden(rng) -> tuple[lgb.Booster, pd.DataFrame, pd.DataFrame, np.ndarray]:
    train = synthetic(rng, 800)
    logit = (1.2 * train["f_normal"] - 0.8 * train["f_uniform"]
             + np.sin(train["iso_week"] / 52 * 2 * np.pi) + 0.5 * train["f_gappy"].fillna(0) - 0.7)
    y = (rng.random(len(train)) < 1 / (1 + np.exp(-logit))).astype(int).to_numpy()
    # lightgbm.train on a pandas frame, as final_model.evaluate and fit_calibrated call it.
    model = lgb.train(PARAMS, lgb.Dataset(train, label=y), num_boost_round=ROUNDS)
    test = synthetic(rng, 64)
    test.iloc[0] = np.nan
    test.iloc[1] = [50.0, -40.0, 60.0, 1e6, 7.0, -1e3]
    out = {
        "source": "lightgbm.train(PARAMS, lightgbm.Dataset(frame, label=y)); Booster.predict",
        "params": PARAMS, "rounds": ROUNDS, "names": NAMES,
        "trainX": nulls(train.to_numpy()), "trainY": y.tolist(), "testX": nulls(test.to_numpy()),
        "predict64": model.predict(test).tolist(),
        "predict32": model.predict(test.astype("float32")).tolist(),
        "predictTrain": model.predict(train).tolist(),
        "gain": model.feature_importance("gain").tolist(),
        "split": model.feature_importance("split").tolist(),
        "iterations": model.current_iteration(),
    }
    (ROOT / "backend-go/internal/pipeline/model/lgbm/testdata/golden.json").write_text(json.dumps(out))
    (ROOT / "backend-go/internal/pipeline/model/lgbm/testdata/golden_model.txt").write_text(model.model_to_string())
    return model, train, test, y


def bundle_golden(rng, model, train, test, y) -> None:
    out_dir = ROOT / "backend-go/internal/pipeline/model/bundle/testdata/bundle_v1"
    out_dir.mkdir(parents=True, exist_ok=True)
    small = ["f_normal", "f_uniform", "iso_week", "f_gappy"]
    model2 = lgb.train(dict(PARAMS, num_leaves=7), lgb.Dataset(train[small], label=y), num_boost_round=20)
    horizons = {}
    expect = {}
    for h, booster, feats in ((0, model, NAMES), (2, model2, small)):
        idx = np.arange(len(train))
        fit, cal = idx[:500], idx[500:]
        raw = booster.predict(train[feats].iloc[cal])
        # The calibration steps of final_model.fit_calibrated, on the scores of an already trained model.
        iso = IsotonicRegression(out_of_bounds="clip").fit(raw, y[cal])
        order = np.argsort(raw)[::-1]
        support = max(30, int(0.02 * len(order)))
        ceiling = float(y[cal][order[:support]].mean())
        (out_dir / f"h{h}.txt").write_text(booster.model_to_string())
        horizons[str(h)] = {
            "model": f"h{h}.txt", "features": feats, "ceiling": ceiling, "rounds": booster.current_iteration(),
            "params": PARAMS,
            "isotonic": {"x": iso.X_thresholds_.tolist(), "y": iso.y_thresholds_.tolist(),
                         "xMin": float(iso.X_min_), "xMax": float(iso.X_max_),
                         "increasing": bool(iso.increasing_), "outOfBounds": "clip"},
            "metrics": {"brierRaw": 0.1, "brierCalibrated": 0.09, "aucOof": None},
        }
        probe = np.concatenate([raw[:20], iso.X_thresholds_, [-1.0, 2.0, iso.X_min_, iso.X_max_],
                                (iso.X_thresholds_[:-1] + iso.X_thresholds_[1:]) / 2])
        x32 = test[feats].to_numpy(dtype="float32")
        expect[str(h)] = {
            "source": "final_model.calibrated(model, iso, ceiling, x) on a float32 matrix; IsotonicRegression.predict",
            "x": nulls(x32), "p": fm.calibrated(booster, iso, ceiling, x32).tolist(),
            "probe": probe.tolist(), "probeIso": iso.predict(probe).tolist(), "ceiling": ceiling,
        }
    frame = train.assign(label=y, iso_year=2015 + np.arange(len(train)) % 7,
                         cell=[f"{a}_{b}" for a, b in zip(rng.integers(800, 806, len(train)),
                                                         rng.integers(560, 563, len(train)))],
                         block=[f"{a}_{b}" for a, b in zip(rng.integers(160, 162, len(train)),
                                                          rng.integers(112, 114, len(train)))])
    tables = fm.prior_tables(frame, np.arange(len(frame)))
    prior = {k: {"keys": t[k].astype(str).tolist(), "rate": nulls(t["rate"]), "n": t["n"].tolist()}
             for k, t in tables.items()}
    bundle = {"format": 1, "label": "test_species", "species": ["Testus specius"], "slug": "testus-specius",
              "horizons": horizons, "prior": prior, "trainedAt": "2026-10-08T00:00:00Z",
              "visits": int(len(y)), "positives": int(y.sum())}
    (out_dir / "bundle.json").write_text(json.dumps(bundle))
    (out_dir.parent / "expect.json").write_text(json.dumps(expect))


def train_golden(rng) -> None:
    n = 3000
    frame = pd.DataFrame({
        "x": rng.uniform(4.0e6, 4.6e6, n), "y": rng.uniform(2.7e6, 3.3e6, n),
        "iso_year": rng.integers(2015, 2023, n), "label": (rng.random(n) < 0.08).astype(int),
    })
    frame.loc[:5, "x"] = [4.1e6, 4.2e6 - 1e-9, 4.2e6, 4299999.999999999, 4.3e6 + 1e-9, 4.4e6]
    frame["cell"] = ((frame["x"] // 5000).astype(int).astype(str) + "_"
                     + (frame["y"] // 5000).astype(int).astype(str))
    frame["block"] = fm.block_key(frame)
    year = fm.blocked_folds(frame, "year")
    space = fm.blocked_folds(frame, "space")
    everything = np.arange(n)
    train, test = year[0]

    def cols(p):
        return {name: nulls(p[name].to_numpy()) for name in fm.PRIOR}

    tables = fm.prior_tables(frame, everything)
    gains = np.array([5.0, 0.0, 12.5, 5.0, 0.01, 3.3, 7.7, 0.2, 12.5, 1.1, 0.0, 4.0])
    names = [f"g{i}" for i in range(len(gains))]
    # The ranking lines of final_model.main, copied: they are not a function there.
    ranked = sorted(zip(names, gains), key=lambda kv: -kv[1])
    order = [name for name, _ in ranked]
    total = sum(g for _, g in ranked)
    earned = [name for name, g in ranked if g >= fm.MIN_GAIN * total]
    sizes_feats = 12
    candidates = [order[:s] for s in fm.SIZES if s < sizes_feats]
    candidates.append(earned)
    candidates.append(order)
    candidates = sorted(candidates, key=len)
    raw = rng.random(1000)
    yc = (rng.random(1000) < raw * 0.3).astype(int)
    order_c = np.argsort(raw)[::-1]
    ceiling = float(yc[order_c[:max(30, int(0.02 * len(order_c)))]].mean())
    p = rng.random(777)
    yb = (rng.random(777) < p).astype(int)
    rng2 = np.random.default_rng(3)
    arrays = {str(k): rng2.normal(size=k).tolist() for k in (1, 7, 8, 100, 128, 129, 1000, 12345)}
    rng2 = np.random.default_rng(3)
    means = {str(k): float(np.mean(rng2.normal(size=k))) for k in (1, 7, 8, 100, 128, 129, 1000, 12345)}
    floordiv = [[a, b, float(a // b)] for a, b in
                [(4.2e6 - 1e-9, 1e5), (-7.5, 2.0), (1e5 * 3, 1e5), (-0.0, 25000.0), (299999.99999999994, 1e5)]]
    out = {
        "source": {"folds": "final_model.blocked_folds", "prior": "final_model.prior_columns",
                   "tables": "final_model.prior_tables", "block": "final_model.block_key",
                   "rank": "final_model.main ranking lines", "ceiling": "final_model.fit_calibrated ceiling lines",
                   "brier": "sklearn.metrics.brier_score_loss", "mean": "numpy.mean"},
        "x": frame["x"].tolist(), "y": frame["y"].tolist(), "isoYear": frame["iso_year"].tolist(),
        "label": frame["label"].tolist(), "cell": frame["cell"].tolist(), "block": frame["block"].tolist(),
        "yearFolds": [[a.tolist(), b.tolist()] for a, b in year],
        "spaceFolds": [[a.tolist(), b.tolist()] for a, b in space],
        "priorFold": cols(fm.prior_columns(frame, train, test)),
        "priorAll": cols(fm.prior_columns(frame, everything, np.array([], int))),
        "tables": {k: {"keys": t[k].astype(str).tolist(), "rate": t["rate"].tolist(), "n": t["n"].tolist()}
                   for k, t in tables.items()},
        "gainNames": names, "gains": gains.tolist(), "order": order, "earned": earned, "total": total,
        "candidates": candidates,
        "ceilingRaw": raw.tolist(), "ceilingY": yc.tolist(), "ceiling": ceiling,
        "brierP": p.tolist(), "brierY": yb.tolist(), "brier": brier_score_loss(yb, p),
        "meanArrays": arrays, "means": means, "floordiv": floordiv,
        "grid": [[label, params, rounds] for label, params, rounds in fm.GRID],
    }
    (ROOT / "backend-go/internal/pipeline/model/train/testdata/golden.json").write_text(json.dumps(out))


def main() -> None:
    rng = np.random.default_rng(20261008)
    model, train, test, y = lgbm_golden(rng)
    bundle_golden(rng, model, train, test, y)
    train_golden(rng)
    print("lightgbm", lgb.__version__, "dataset params:",
          lgb.Dataset(train, label=y, params=PARAMS).construct().get_params())


if __name__ == "__main__":
    main()

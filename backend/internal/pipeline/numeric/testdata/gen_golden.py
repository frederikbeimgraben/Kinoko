"""Write the golden fixtures of package numeric.

Run in the modell dev shell (numpy 2.4, scipy 1.17, sklearn 1.8):
  cd /home/user/Kinoko/modell && nix develop . -c python \
    ../backend-go/internal/pipeline/numeric/testdata/gen_golden.py
NaN goes to JSON null. float32 values are written as their exact float64.
"""

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.ndimage import convolve, gaussian_filter, map_coordinates, uniform_filter
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "modell" / "src"))
from pilze.coarse_inputs import CoarseSampler  # noqa: E402
from pilze.final_model import blocked_folds  # noqa: E402

OUT = Path(__file__).resolve().parent


def clean(v):
    if isinstance(v, np.ndarray):
        return [clean(x) for x in v.tolist()]
    if isinstance(v, (list, tuple)):
        return [clean(x) for x in v]
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, (np.floating, float)):
        f = float(v)
        return None if math.isnan(f) else f
    if isinstance(v, np.integer):
        return int(v)
    return v


def dump(name, data):
    (OUT / name).write_text(json.dumps(clean(data)))


rng = np.random.default_rng(7)

# gaussian_filter
cases = []
a32 = (rng.random((37, 53)) * 10).astype("float32")
a64 = rng.random((37, 53))
small = (rng.random((3, 4)) * 5).astype("float32")
for arr, sigma, mode in [(a32, 0.5, "constant"), (a32, 1.2, "reflect"), (a64, 1.2, "reflect"),
                         (a32, 1.2, "nearest"), (small, 1.2, "reflect"), (a64, 2.0, "constant"),
                         (small, 0.5, "constant")]:
    cases.append({"dtype": str(arr.dtype), "ny": arr.shape[0], "nx": arr.shape[1],
                  "sigma": sigma, "mode": mode, "input": arr.ravel(),
                  "output": gaussian_filter(arr, sigma, mode=mode).ravel()})
dump("gaussian.json", cases)

# uniform_filter, as tree_scales.py (constant, times size^2) and static_features.py (nearest)
cases = []
counts = rng.integers(0, 40, (37, 53)).astype("float32")
counts[rng.random((37, 53)) < 0.3] = 0
for arr, size, mode in [(counts, 5, "constant"), (counts, 9, "constant"), (counts, 21, "constant"),
                        (a32, 5, "nearest"), (a32, 11, "nearest"), (a32, 4, "reflect")]:
    cases.append({"ny": arr.shape[0], "nx": arr.shape[1], "size": size, "mode": mode,
                  "input": arr.ravel(), "output": uniform_filter(arr, size=size, mode=mode).ravel(),
                  "sum": (uniform_filter(arr, size=size, mode="constant") * size * size).ravel()})
dump("uniform.json", cases)

# convolve 3x3x1 (visit_model.ActivityFields) and map_coordinates(order=1, mode="nearest")
vol = rng.integers(0, 4, (6, 5, 4)).astype("float32")
box = convolve(vol, np.ones((3, 3, 1), dtype="float32"), mode="constant")
rate = rng.random((5, 6, 7)).astype("float32")
pts = np.vstack([rng.uniform(-1.5, 6.5, 40), rng.uniform(-1.5, 7.5, 40),
                 rng.integers(0, 7, 40).astype("float64")])
pts[:, 0] = [0.0, 0.0, 0.0]
pts[:, 1] = [4.0, 5.0, 6.0]
dump("volume.json", {"vol": vol.ravel(), "shape": vol.shape, "box": box.ravel(),
                     "rate": rate.ravel(), "rate_shape": rate.shape, "coords": pts.T,
                     "values": map_coordinates(rate, pts, order=1, mode="nearest")})

# CoarseSampler (coarse_inputs.CoarseSampler) on a grid with gaps
grid = [(cx, cy) for cx in range(100, 112) for cy in range(600, 609)]
keep = rng.random(len(grid)) < 0.75
cells = np.array([g for g, k in zip(grid, keep) if k])
xs = rng.uniform(99 * 5000, 113 * 5000, 300)
ys = rng.uniform(599 * 5000, 610 * 5000, 300)
s = CoarseSampler(cells[:, 0], cells[:, 1], xs, ys, 5000)
columns = []
for j in range(3):
    v = (rng.normal(10, 3, len(cells))).astype("float32")
    if j == 1:
        v[rng.random(len(cells)) < 0.3] = np.nan
    if j == 2:
        v[:] = np.nan
        v[:5] = 1.0
    columns.append({"values": v, "out": s.sample(v)})
dump("coarse.json", {"cells": cells, "x": xs, "y": ys, "columns": columns})

# IsotonicRegression(out_of_bounds="clip")
cases = []
raw = np.round(rng.random(400), 2)
lab = (rng.random(400) < raw).astype(float)
grid = np.concatenate([[-1.0, 2.0], np.linspace(-0.1, 1.1, 97), raw[:20]])
for x, y in [(raw, lab), (rng.random(50), rng.random(50)),
             (np.array([1.0, np.nextafter(1.0, 2.0), 1.0 + 1e-14, 2.0, 2.0, 3.0]),
              np.array([1.0, 0.0, 1.0, 0.0, 1.0, 0.0])),
             (np.array([0.5, 0.5, 0.5]), np.array([0.0, 1.0, 1.0]))]:
    iso = IsotonicRegression(out_of_bounds="clip").fit(x, y)
    cases.append({"x": x, "y": y, "X": iso.X_thresholds_, "Y": iso.y_thresholds_,
                  "xmin": iso.X_min_, "xmax": iso.X_max_, "t": grid, "pred": iso.predict(grid)})
dump("isotonic.json", cases)

# roc_auc_score, average_precision_score, brier_score_loss
cases = []
for n, digits in [(1000, 2), (1000, 6), (37, 1), (500, 3)]:
    p = np.round(rng.random(n), digits)
    y = (rng.random(n) < p * 0.6).astype("int8")
    cases.append({"y": y, "p": p, "auc": roc_auc_score(y, p),
                  "ap": average_precision_score(y, p), "brier": brier_score_loss(y, p)})
y = np.array([0, 0, 1, 1], dtype="int8")
p = np.array([0.1, 0.4, 0.35, 0.8])
cases.append({"y": y, "p": p, "auc": roc_auc_score(y, p),
              "ap": average_precision_score(y, p), "brier": brier_score_loss(y, p)})
dump("metrics.json", cases)

# RandomState permutations and stratified splits
perms = [{"seed": seed, "n": n, "perm": np.random.RandomState(seed).permutation(n)}
         for seed in (0, 42, 4294967295) for n in (1, 2, 5, 10, 100, 1000)]
splits = []
for n, share in [(20, 0.3), (101, 0.1), (1000, 0.05), (1234, 0.5), (57, 0.2)]:
    y = (rng.random(n) < share).astype("int8")
    y[:2], y[2:4] = 1, 0
    idx = np.sort(rng.choice(5 * n, n, replace=False))
    fit, cal = train_test_split(idx, test_size=0.25, random_state=0, stratify=y)
    splits.append({"idx": idx, "y": y, "train": fit, "test": cal})
y3 = rng.integers(0, 3, 90).astype("int8")
idx3 = np.arange(90)
fit, cal = train_test_split(idx3, test_size=0.25, random_state=0, stratify=y3)
splits.append({"idx": idx3, "y": y3, "train": fit, "test": cal})
dump("random.json", {"perms": perms, "splits": splits})

# np.nanpercentile with a list of q, and np.sum
cases = []
for n in (1, 2, 3, 10, 101, 1000):
    v = (rng.normal(0, 5, n)).astype("float32")
    if n > 3:
        v[rng.random(n) < 0.2] = np.nan
    qs = [1, 99, 2, 98, 0, 50, 100, 37.5]
    cases.append({"v": v, "q": qs, "f32": np.nanpercentile(v, qs),
                  "f64": np.nanpercentile(v.astype("float64"), qs)})
sums = []
for n in (0, 1, 7, 8, 9, 16, 127, 128, 129, 300, 1000, 10001):
    v = rng.normal(0, 1e3, n) * rng.random(n)
    sums.append({"v": v, "f64": np.sum(v), "f32": float(np.sum(v.astype("float32")))})
dump("stats.json", {"percentile": cases, "sum": sums})

# final_model.blocked_folds
n = 3000
frame = pd.DataFrame({"iso_year": rng.integers(2015, 2025, n),
                      "x": rng.uniform(4.0e6, 4.6e6, n),
                      "label": (rng.random(n) < 0.05).astype("int8")})
frame.loc[frame["iso_year"] == 2016, "label"] = 0
year = blocked_folds(frame, "year")
space = blocked_folds(frame, "space")
dump("folds.json", {
    "year_key": frame["iso_year"].to_numpy(), "space_key": (frame["x"].to_numpy() // 100_000).astype(int),
    "label": frame["label"].to_numpy(), "x": frame["x"].to_numpy(),
    "year": [{"train": tr, "test": te} for tr, te in year],
    "space": [{"train": tr, "test": te} for tr, te in space]})
print("ok")

"""Write the golden files of the Go packages under internal/pipeline/core.

Run from the repository root with numpy and pyproj on the path:
    python backend-go/internal/pipeline/core/testdata/golden.py
The reference functions come from modell/src/pilze.
"""
from __future__ import annotations

import json
import math
import random
import struct
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT / "modell" / "src" / "pilze"))
CORE = Path(__file__).resolve().parents[1]

import horizons  # noqa: E402
import manifest  # noqa: E402
import pyramid  # noqa: E402
import tiles  # noqa: E402


def hexf(x: float) -> str:
    """A float as the hex of its bits, so NaN, -0.0 and every bit survive."""
    return struct.pack(">d", float(x)).hex()


def save(pkg: str, name: str, data) -> None:
    path = CORE / pkg / "testdata" / name
    path.write_text(json.dumps(data, ensure_ascii=False) + "\n")


def calendar_golden() -> None:
    import pandas as pd

    days = [date(2014, 12, 20) + timedelta(days=k) for k in range(0, 365 * 17, 3)]
    days += [date(y, m, d) for y in range(2014, 2032) for m, d in ((1, 1), (1, 3), (1, 4), (12, 28), (12, 29), (12, 31))]
    rows = []
    frame = pd.DataFrame({"iso_year": [d.isocalendar()[0] for d in days],
                          "iso_week": [d.isocalendar()[1] for d in days]})
    # build_dataset.week_number, inlined: importing build_dataset needs lightgbm.
    ids = (frame["iso_year"].astype(int) * 53 + frame["iso_week"].astype(int)).tolist()
    for d, wid in zip(days, ids):
        y, w, _ = d.isocalendar()
        rows.append({"date": d.isoformat(), "year": y, "week": w, "id": wid,
                     "monday": date.fromisocalendar(y, w, 1).isoformat()})
    pairs = []
    rng = random.Random(3)
    for _ in range(300):
        a, b = rng.choice(rows), rng.choice(rows)
        pairs.append({"a": [a["year"], a["week"]], "b": [b["year"], b["week"]],
                      "distance": horizons._week_distance((a["year"], a["week"]), (b["year"], b["week"]))})
    valid53 = {y: date(y, 12, 28).isocalendar()[1] == 53 for y in range(2000, 2040)}
    save("calendar", "weeks.json", {"days": rows, "distances": pairs, "has53": valid53})


def horizons_golden() -> None:
    names = ["pr_lag0", "pr_lag1", "pr_lag2", "pr_lag8", "tas_lag12", "pr_sum4", "pr_sum8_anom",
             "tas_mean2", "tas_anom", "hurs_ratio", "tas_drop_2w", "tas_drop_4w", "n_records",
             "iso_week", "tree_spruce_1km", "prior_rate_cell", "activity_rate_7d_h2",
             "pr_lag", "pr_lag2x", "x_mean", "frost_days_sum4", "dem_mean"]
    knowable = [{"name": n, "h": h, "known": horizons.knowable(n, h)} for n in names for h in range(6)]
    activity = {str(h): horizons.activity_names(h) for h in range(6)}
    forecast = []
    rng = random.Random(5)
    for _ in range(400):
        today = date(2015, 1, 1) + timedelta(days=rng.randrange(0, 365 * 15))
        back = today - timedelta(days=rng.randrange(-14, 60))
        obs = back.isocalendar()[:2]
        cap = rng.choice([0, 1, 2, 4, 6])
        lead = rng.choice([0, 2, 3])
        forecast.append({"today": today.isoformat(), "observed": list(obs), "cap": cap, "lead": lead,
                         "weeks": horizons.forecast_weeks(today, tuple(obs), cap, lead)})
    # horizon_for golden only inside one year: across New Year it carries bug 4.
    horizon = []
    for _ in range(300):
        y = rng.randrange(2015, 2030)
        last = rng.randrange(1, 40)
        week = rng.randrange(1, 52)
        avail = sorted(rng.sample(range(0, 6), rng.randrange(1, 5)))
        try:
            h = horizons.horizon_for(y * 53 + week, y * 53 + last, avail)
        except SystemExit:
            h = None
        horizon.append({"year": y, "last": last, "week": week, "available": avail, "horizon": h})
    shared = []
    for _ in range(100):
        sets = [sorted(rng.sample(range(0, 6), rng.randrange(0, 6))) for _ in range(rng.randrange(0, 4))]
        shared.append({"sets": sets, "shared": horizons.shared_horizon([set(s) for s in sets])})
    save("horizons", "horizons.json", {"knowable": knowable, "activity": activity,
                                       "forecast": forecast, "horizon": horizon, "shared": shared})


def geo_golden() -> None:
    from pyproj import Transformer

    rng = np.random.default_rng(11)
    lon = rng.uniform(5.5, 15.5, 1000)
    lat = rng.uniform(47.0, 55.2, 1000)
    fwd = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True)
    x, y = fwd.transform(lon, lat)
    inv = Transformer.from_crs("EPSG:3035", "EPSG:4326", always_xy=True)
    ilon, ilat = inv.transform(x, y)
    laea = [{"lon": hexf(a), "lat": hexf(b), "x": hexf(c), "y": hexf(d), "ilon": hexf(e), "ilat": hexf(f)}
            for a, b, c, d, e, f in zip(lon, lat, x, y, ilon, ilat)]
    merc_pts = [(lo, la) for lo, la in zip(rng.uniform(-180, 180, 200), rng.uniform(-85, 85, 200))]
    merc = [{"lon": hexf(lo), "lat": hexf(la), "x": hexf(pyramid.to_mercator(lo, la)[0]),
             "y": hexf(pyramid.to_mercator(lo, la)[1])} for lo, la in merc_pts]
    zooms = [{"res": r, "zoom": pyramid.finest_zoom(r)}
             for r in (1, 5, 10, 20, 50, 90, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 100000)]
    zooms += [{"res": r, "cap": 14, "base": 3, "zoom": pyramid.finest_zoom(r, 14, 3)} for r in (5, 10, 90, 100000)]
    ranges = []
    for _ in range(200):
        z = int(rng.integers(0, 15))
        w, e = sorted(rng.uniform(-tiles.RAND, tiles.RAND, 2))
        s, n = sorted(rng.uniform(-tiles.RAND, tiles.RAND, 2))
        r = tiles.kachelraster(w, s, e, n, z)
        ranges.append({"box": [hexf(v) for v in (w, s, e, n)], "z": z, "range": list(r),
                       "tilebox": [hexf(v) for v in tiles.kachelbox(*r, z)]})
    vals = [float(v) for v in np.concatenate([
        (np.arange(0, 255) + 0.5) / 254.0, np.arange(0, 255) / 254.0,
        rng.uniform(-0.2, 1.2, 500), [np.nan, np.inf, -np.inf, -0.0, 1e-30, 0.999999]]).astype("float32")]
    codes = tiles.to_byte(np.array(vals, dtype="float32")).tolist()
    back = tiles.from_byte(np.arange(256, dtype="uint8"))
    byte = {"values": [struct.pack(">f", v).hex() for v in vals], "codes": codes,
            "from": [struct.pack(">f", v).hex() for v in back]}
    tl = [(int(rng.integers(5, 12)), int(rng.integers(0, 40)), int(rng.integers(0, 40))) for _ in range(60)]
    have = {"tiles": tl, "have": pyramid.belegung(tl), "upTo9": pyramid.have_up_to(tl, 9)}
    cx = np.concatenate([rng.uniform(-1e6, 7e6, 300), np.arange(-3, 4) * 5000.0,
                         np.array([4999.999999999999, 5000.000000000001, -1e-12, 1e-300, -0.0, 0.0])])
    cy = rng.uniform(2e6, 4e6, cx.size)
    cells = [{"x": hexf(a), "y": hexf(b), "size": hexf(sz),
              "cell": f"{int(a // sz)}_{int(b // sz)}",
              "np": f"{(np.array([a]) // sz).astype('int32')[0]}_{(np.array([b]) // sz).astype('int32')[0]}"}
             for a, b in zip(cx, cy) for sz in (5000.0, 500.0, 0.1)]
    save("geo", "laea.json", laea)
    save("geo", "tiles.json", {"mercator": merc, "zooms": zooms, "ranges": ranges, "bytes": byte,
                                "have": have, "cells": cells})


def typed(v):
    """A value as a typed tree that the Go test rebuilds without loss."""
    if v is None:
        return {"t": "null"}
    if isinstance(v, bool):
        return {"t": "bool", "v": v}
    if isinstance(v, int):
        return {"t": "int", "v": str(v)}
    if isinstance(v, float):
        return {"t": "float", "v": hexf(v)}
    if isinstance(v, str):
        return {"t": "str", "v": v}
    if isinstance(v, list):
        return {"t": "list", "v": [typed(x) for x in v]}
    if isinstance(v, dict):
        return {"t": "obj", "v": [[k, typed(x)] for k, x in v.items()]}
    raise TypeError(type(v))


def manifest_cases() -> list:
    h = manifest.histogram(np.linspace(0, 0.5043, 500), 0.0, 0.5043)
    return [
        {},
        [],
        {"a": []},
        {"a": {}},
        {"name": "Steinpilz", "label": "Fläche öäüß", "emoji": "Pilz \U0001F344", "ctl": "a\tb\nc\x01\x7f\"\\/"},
        {"floats": [0.0, -0.0, 1.0, 1e-05, 0.0001, 151.9, 1e16, 1e15, 123456789012345680.0, 2.5e-308, 1.7976931348623157e308,
                    0.1, 1/3, 5e-324, -1e-7, 100.0, 9999999999999998.0]},
        {"nan": float("nan"), "inf": float("inf"), "ninf": float("-inf"), "list": [1.0, float("nan"), 2.0]},
        {"ints": [1, -2, 0, 12345678901234], "mixed": [1, 2.5, -3e-06], "bools": [True, False, None]},
        {"bounds": [[47.1, 4.9], [55.2, 15.1]], "zooms": [5, 8], "have": {"5": ["16/10", "16/11"]}, "histogram": h},
        {"weeks": ["2026W35", "2026W36"], "nested": [[[1, 2], [3]], [], [[]]]},
        {"text": "[1, 2]", "text2": "[1,2,3]"},
        {"weeks": [{"year": 2026, "week": 36, "forecast": False, "tiles": "2026W36", "mean": 0.123456, "max": 0.5,
                    "histogram": h}], "top": 0.5043, "species": ["Boletus edulis"]},
        {"layers": {"temperatur": {"label": "Mitteltemperatur der Woche", "unit": "°C", "static": False,
                                   "low": -3.6, "high": 24.7, "weeks": ["2026W35"],
                                   "histograms": {"2026W35": manifest.histogram(np.linspace(-3.6, 24.7, 777), -3.6, 24.7)}}}},
        {"big": [1e22, 1e-22, 12345.678, 0.000123, 1.5e-05, -9.87e+20]},
        {"deep": {"a": {"b": {"c": [1.0, {"d": [2, 3]}]}}}},
        {"e": ["e", "E", "1e5"], "numstr": ["1", "2"]},
        {"keys with \"quote\"": 1, "ümlaut": 2, "": 3},
        [1, [2, [3, [4]]]],
        "ein Text",
        3.0,
        {"neg": [-1, -2.5, -0.0001, -1e-05]},
        {"spaces": [1.0, 2.0], "obj_in_list": [{"a": 1}, {"b": [1.5]}]},
    ]


def pyjson_golden() -> None:
    import tempfile

    cases = []
    for meta in manifest_cases():
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "m.json"
            manifest.schreibe(p, meta)
            schreibe = p.read_bytes().decode("utf-8")
        cases.append({"value": typed(meta), "manifest": schreibe,
                      "indent2": json.dumps(meta, indent=2), "indent0": json.dumps(meta, indent=0),
                      "default": json.dumps(meta), "unicode": json.dumps(meta, indent=1, ensure_ascii=False),
                      "compact": json.dumps(meta, separators=(",", ":")),
                      "compactUnicode": json.dumps(meta, separators=(",", ":"), ensure_ascii=False)})
    rng = np.random.default_rng(13)
    floats = list(rng.uniform(-1, 1, 300) * 10.0 ** rng.integers(-30, 30, 300))
    floats += list(rng.integers(0, 2**63, 200).view("float64"))
    floats += [0.5, 1.0, 1e-4, 1e-5, 9.999e-5, 1e16, 9.999999999999999e15, 1e15 + 0.3, 123.0, 0.1 + 0.2]
    reprs = [{"bits": hexf(f), "repr": repr(float(f)) if math.isfinite(f) else json.dumps(float(f))}
             for f in floats]
    rounds = []
    tie = [0.125, 0.375, 2.5, 0.5, 1.5, 2.675, 1.0000005, 0.0000005, 0.0000015, 0.1234565, -0.1234565, 1e-7, -1e-7]
    for x in tie + list(rng.uniform(-100, 100, 300)) + list(rng.uniform(0, 1, 300) / 7):
        for nd in (0, 1, 2, 6, 10):
            rounds.append({"x": hexf(x), "nd": nd, "r": hexf(round(float(x), nd))})
    save("pyjson", "dumps.json", cases)
    save("pyjson", "floats.json", {"repr": reprs, "round": rounds})


def hist_golden() -> None:
    rng = np.random.default_rng(17)
    cases = [
        (np.linspace(0.0, 10.0, 1000), 0.0, 10.0),
        (rng.normal(5.0, 2.0, 5000), 0.0, 10.0),
        (np.linspace(0.0, 8.0, 40, endpoint=False) + 0.1, 0.0, 8.0),
        (np.array([np.nan, 0.5, np.inf, 0.5]), 0.0, 1.0),
        (np.array([-100.0, 100.0]), 0.0, 1.0),
        (np.array([0.0, 0.0, 1.0]), 0.0, 1.0),
        (np.full(16, np.nan), 0.0, 1.0),
        (np.array([]), 0.0, 1.0),
        (np.linspace(-3.6, 24.7, 777), -3.6, 24.7),
        (rng.uniform(-5, 30, 3000), -3.6, 24.7),
        (np.linspace(0, 0.5043, 500), 0.0, 0.5043),
        # Edges as values: each sits on a class border.
        (np.linspace(-3.6, 24.7, 41), -3.6, 24.7),
        (np.linspace(0.1, 0.7, 41), 0.1, 0.7),
        (rng.uniform(0, 1e-9, 200), 0.0, 1e-9),
        (np.round(rng.uniform(0, 254, 2000)) / 254 * 0.37, 0.0, 0.37),
    ]
    out = []
    for vals, low, high in cases:
        h = manifest.histogram(vals, low, high)
        out.append({"values": [hexf(v) for v in vals], "low": hexf(low), "high": hexf(high),
                    "json": None if h is None else json.dumps(h, separators=(",", ":"))})
    save("hist", "histogram.json", out)


if __name__ == "__main__":
    calendar_golden()
    horizons_golden()
    geo_golden()
    pyjson_golden()
    hist_golden()

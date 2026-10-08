"""Write the pio test fixtures and their expected values.

Run in the modell shell from backend-go/internal/pipeline/pio:
    nix develop /home/user/Kinoko/modell -c python -I testdata/gen_fixtures.py testdata
The Go tests read the files that this script writes. They do not run Python.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

out = Path(sys.argv[1])


def clean(values):
    """Give a JSON value list. NaN and NaT become null."""
    result = []
    for v in values:
        if v is None or (isinstance(v, float) and math.isnan(v)) or v is pd.NaT:
            result.append(None)
        elif isinstance(v, (np.floating, float)):
            result.append(None if np.isnan(v) else float(v))
        elif isinstance(v, (np.integer,)):
            result.append(int(v))
        elif isinstance(v, (np.bool_, bool)):
            result.append(bool(v))
        elif isinstance(v, pd.Timestamp):
            result.append(v.isoformat())
        else:
            result.append(v)
    return result


# Parquet: the dtypes of the chain tables (section 3.1 of the plan).
frame = pd.DataFrame({
    "iso_year": np.array([2024, 2024, 2025, 2025, 2026, 2026, 2026], dtype=np.int16),
    "iso_week": np.array([1, 52, 1, 2, 7, 53, -3], dtype=np.int8),
    "doy": np.array([1, 360, 2, 9, 45, 366, 100], dtype=np.int16),
    "cell": pd.Categorical(["4100_2800", "4100_2801", "4100_2800", "4200_2900",
                            "4100_2800", "4200_2900", "4100_2801"]),
    "cell_x": np.array([820, 821, -5, 822, 0, 2147483647, -2147483648], dtype=np.int32),
    "gx": np.array([1, 2, 3, 4, 5, 6, 2**40], dtype=np.int64),
    "pr": np.array([0.5, np.nan, 1.25, 3.0e-7, -2.5, 1e30, 7.0], dtype=np.float32),
    "x": np.array([4100250.5, 4100750.25, np.nan, 1.0 / 3.0, -0.0, 5e-324, 2.0], dtype=np.float64),
    "date": pd.to_datetime(["2024-01-01", "2024-12-25T13:45:30.123456789", None,
                            "2025-01-09", "1999-02-03", "2026-02-14", "2262-04-11"], format="ISO8601"),
    "species": ["Boletus edulis", None, "Cantharellus cibarius", "Boletus edulis",
                "Äußerer Pilz", "", "Boletus edulis"],
    "flag": np.array([True, False, True, True, False, False, True]),
})
frame.to_parquet(out / "pandas_types.parquet", index=False, row_group_size=3)
expected = {"rows": len(frame)}
for name in frame.columns:
    expected[name] = clean(list(frame[name].astype(object)))
(out / "pandas_types.json").write_text(json.dumps(expected, indent=1))

# netCDF shaped like HYRAS: dims (time, y, x), 1-D x and y in metres, CF time.
x = np.array([4031000.0, 4032000.0, 4033000.0])
y = np.array([3550000.0, 3551000.0, 3552000.0, 3553000.0])
time = pd.date_range("2020-12-30", periods=5, freq="D")
rng = np.random.default_rng(7)
pr = rng.uniform(0, 20, size=(5, 4, 3)).astype(np.float32)
pr[0, 0, 0] = np.nan
pr[:, 3, 2] = np.nan
tas = rng.uniform(-15, 30, size=(5, 4, 3)).round(2)
tas[1, 2, 1] = np.nan
hurs = rng.uniform(30, 100, size=(5, 4, 3)).round(1)
hurs[4, 0, 2] = np.nan
ds = xr.Dataset(
    {
        "pr": (("time", "y", "x"), pr, {"units": "mm", "long_name": "precipitation"}),
        "tas": (("time", "y", "x"), tas, {"units": "degC"}),
        "hurs": (("time", "y", "x"), hurs, {"units": "%"}),
    },
    coords={"time": time, "x": ("x", x, {"units": "m"}), "y": ("y", y, {"units": "m"})},
)
ds.to_netcdf(
    out / "hyras_tiny.nc",
    format="NETCDF4",
    encoding={
        "pr": {"dtype": "float32", "_FillValue": np.float32(-999.0), "zlib": True},
        "tas": {"dtype": "int16", "scale_factor": np.float32(0.01),
                "add_offset": np.float32(5.0), "_FillValue": np.int16(-32768)},
        "hurs": {"dtype": "int16", "scale_factor": 0.1, "_FillValue": np.int16(-1)},
        "time": {"units": "days since 1951-01-01", "calendar": "standard", "dtype": "float64"},
    },
)

# Soil moisture style: hours since a reference with a time of day, gregorian calendar.
stime = pd.to_datetime(["2021-03-01T12:00", "2021-03-02T12:00", "2021-03-03T23:59"])
paws = rng.uniform(0, 200, size=(3, 2, 2)).astype(np.float32)
paws[2, 1, 1] = np.nan
sds = xr.Dataset(
    {"paws": (("time", "y", "x"), paws)},
    coords={"time": stime, "x": ("x", [3500000.0, 3501000.0]), "y": ("y", [5300000.0, 5299000.0])},
)
sds.to_netcdf(
    out / "soil_tiny.nc",
    format="NETCDF4",
    encoding={"time": {"units": "hours since 2021-01-01 06:00:00", "calendar": "gregorian", "dtype": "float64"},
              "paws": {"_FillValue": None, "missing_value": np.float32(-9999.0)}},
)

def decoded(path, names):
    """Give the values as xarray decodes them (mask and scale on)."""
    d = xr.open_dataset(path)
    result = {
        "x": d.x.values.tolist(),
        "y": d.y.values.tolist(),
        "days": [t.isoformat() for t in pd.to_datetime(d.time.values).normalize()],
        "vars": {},
    }
    for name in names:
        values = d[name].values
        result["vars"][name] = {"dtype": str(values.dtype), "shape": list(values.shape),
                                "values": clean(values.ravel().tolist())}
    d.close()
    return result


(out / "hyras_tiny.json").write_text(json.dumps(decoded(out / "hyras_tiny.nc", ["pr", "tas", "hurs"]), indent=1))
(out / "soil_tiny.json").write_text(json.dumps(decoded(out / "soil_tiny.nc", ["paws"]), indent=1))

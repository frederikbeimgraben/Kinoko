"""Check that pandas reads a parquet file from pio.WriteParquet with the expected dtypes.

pio_test.TestPandasReadsGoParquet runs this script with the path of the file.
The values match sampleTable in parquet_test.go.
"""
import math
import sys

import numpy as np
import pandas as pd

df = pd.read_parquet(sys.argv[1])
want_dtypes = {
    "iso_year": "int16", "iso_week": "int8", "cell": "object", "pr": "float32",
    "x": "float64", "gx": "int64", "cell_x": "int32", "date": "datetime64[ns]",
    "day": "object", "species": "object", "flag": "bool",
}
assert list(df.columns) == list(want_dtypes), list(df.columns)
for name, dtype in want_dtypes.items():
    assert str(df[name].dtype) == dtype, (name, df[name].dtype, dtype)
assert df.iso_year.tolist() == [2024, 2025, 2026, -32768]
assert df.iso_week.tolist() == [1, 53, 7, -128]
assert df.cell.tolist() == ["4100_2800", "4100_2800", "-1_-2", "Äß"]
assert df.gx.tolist() == [1, -1, 2**63 - 1, -(2**63)]
assert df.cell_x.tolist() == [820, -5, 2**31 - 1, -(2**31)]
pr = df.pr.to_numpy()
assert pr[0] == np.float32(0.1) and math.isnan(pr[1]) and pr[2] == 0 and pr[3] == np.float32(3e38)
x = df.x.to_numpy()
assert x[0] == 4100250 and math.isnan(x[1]) and x[2] == 1 / 3 and x[3] == -1e-300
assert df.date[0] == pd.Timestamp("2024-01-01")
assert df.date[1] == pd.Timestamp("2024-12-25T13:45:30.123456789")
assert df.date[2] is pd.NaT
assert df.date[3] == pd.Timestamp("1960-02-29T23:59:59.000000001")
assert [str(d) for d in df.day] == ["2024-01-01", "1969-12-31", "2026-03-09", "1900-01-01"]
assert df.species.tolist() == ["Boletus edulis", None, "x", "y"]
assert df.flag.tolist() == [True, False, True, False]
print("pandas", pd.__version__, "reads the Go file:", df.shape)

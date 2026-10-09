package pio

import (
	"encoding/json"
	"errors"
	"math"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"
)

// pandasFixture holds the values of testdata/pandas_types.parquet, a file
// with the pandas column types.
type pandasFixture struct {
	Rows    int        `json:"rows"`
	IsoYear []int64    `json:"iso_year"`
	IsoWeek []int64    `json:"iso_week"`
	Doy     []int64    `json:"doy"`
	Cell    []string   `json:"cell"`
	CellX   []int64    `json:"cell_x"`
	Gx      []int64    `json:"gx"`
	Pr      []*float64 `json:"pr"`
	X       []*float64 `json:"x"`
	Date    []*string  `json:"date"`
	Species []*string  `json:"species"`
	Flag    []bool     `json:"flag"`
}

func loadJSON(t *testing.T, path string, v any) {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, v); err != nil {
		t.Fatal(err)
	}
}

func TestReadPandasParquet(t *testing.T) {
	var want pandasFixture
	loadJSON(t, "testdata/pandas_types.json", &want)
	tab, err := ReadParquet("testdata/pandas_types.parquet", nil)
	if err != nil {
		t.Fatal(err)
	}
	if tab.N != want.Rows {
		t.Fatalf("rows %d, want %d", tab.N, want.Rows)
	}
	for name, w := range map[string][]int64{"iso_year": want.IsoYear, "iso_week": want.IsoWeek,
		"doy": want.Doy, "cell_x": want.CellX, "gx": want.Gx} {
		if !slices.Equal(tab.I64[name], w) {
			t.Errorf("%s = %v, want %v", name, tab.I64[name], w)
		}
	}
	if !slices.Equal(tab.Str["cell"], want.Cell) {
		t.Errorf("cell = %v", tab.Str["cell"])
	}
	if !slices.Equal(tab.Bool["flag"], want.Flag) {
		t.Errorf("flag = %v", tab.Bool["flag"])
	}
	for i := range want.Rows {
		checkFloat(t, "pr", i, float64(tab.F32["pr"][i]), want.Pr[i])
		checkFloat(t, "x", i, tab.F64["x"][i], want.X[i])
		if want.Species[i] == nil {
			if !tab.IsNull("species", i) {
				t.Errorf("species[%d] is not null", i)
			}
		} else if tab.IsNull("species", i) || tab.Str["species"][i] != *want.Species[i] {
			t.Errorf("species[%d] = %q, want %q", i, tab.Str["species"][i], *want.Species[i])
		}
		if want.Date[i] == nil {
			if !tab.IsNull("date", i) {
				t.Errorf("date[%d] is not null", i)
			}
			continue
		}
		if got := tab.Time["date"][i].Format("2006-01-02T15:04:05.999999999"); got != trimFraction(*want.Date[i]) {
			t.Errorf("date[%d] = %s, want %s", i, got, *want.Date[i])
		}
	}
	if _, ok := tab.Null["cell"]; ok {
		t.Error("cell has a null mask but no nulls")
	}
}

// trimFraction removes a zero fraction, so the golden text and the Go text agree.
func trimFraction(s string) string {
	ts, err := time.Parse("2006-01-02T15:04:05.999999999", s)
	if err != nil {
		return s
	}
	return ts.Format("2006-01-02T15:04:05.999999999")
}

func checkFloat(t *testing.T, name string, i int, got float64, want *float64) {
	t.Helper()
	if want == nil {
		if !math.IsNaN(got) {
			t.Errorf("%s[%d] = %v, want NaN", name, i, got)
		}
		return
	}
	if got != *want || math.Signbit(got) != math.Signbit(*want) {
		t.Errorf("%s[%d] = %v, want %v", name, i, got, *want)
	}
}

func TestReadParquetProjectionAndScan(t *testing.T) {
	tab, err := ReadParquet("testdata/pandas_types.parquet", []string{"pr", "cell"})
	if err != nil {
		t.Fatal(err)
	}
	if len(tab.F32) != 1 || len(tab.Str) != 1 || len(tab.I64) != 0 {
		t.Errorf("projection read other columns: %+v", tab)
	}
	var sizes []int
	err = ScanParquet("testdata/pandas_types.parquet", []string{"cell"}, func(part *Table) error {
		sizes = append(sizes, part.N)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(sizes, []int{3, 3, 1}) {
		t.Errorf("row groups %v, want [3 3 1]", sizes)
	}
	if _, err := ReadParquet("testdata/pandas_types.parquet", []string{"nope"}); err == nil {
		t.Error("missing column gives no error")
	}
	stop := errors.New("stop")
	if err := ScanParquet("testdata/pandas_types.parquet", nil, func(*Table) error { return stop }); !errors.Is(err, stop) {
		t.Errorf("scan error %v, want stop", err)
	}
}

// weatherSchema is the column layout of a weekly checkpoint (plan section 3.1).
var weatherSchema = []ColumnSpec{
	{"iso_year", Int16}, {"iso_week", Int8}, {"cell", String}, {"pr", Float32},
	{"x", Float64}, {"gx", Int64}, {"cell_x", Int32}, {"date", Timestamp},
	{"day", Date}, {"species", String}, {"flag", Bool},
}

func sampleTable() *Table {
	tab := NewTable(4)
	tab.I64["iso_year"] = []int64{2024, 2025, 2026, -32768}
	tab.I64["iso_week"] = []int64{1, 53, 7, -128}
	tab.Str["cell"] = []string{"4100_2800", "4100_2800", "-1_-2", "Äß"}
	tab.F32["pr"] = []float32{0.1, float32(math.NaN()), -0, 3e38}
	tab.F64["x"] = []float64{4100250, math.NaN(), 1.0 / 3.0, -1e-300}
	tab.I64["gx"] = []int64{1, -1, math.MaxInt64, math.MinInt64}
	tab.I64["cell_x"] = []int64{820, -5, math.MaxInt32, math.MinInt32}
	tab.Time["date"] = []time.Time{
		time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2024, 12, 25, 13, 45, 30, 123456789, time.UTC),
		{},
		time.Date(1960, 2, 29, 23, 59, 59, 1, time.UTC),
	}
	tab.Time["day"] = []time.Time{
		time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		time.Date(1969, 12, 31, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 3, 9, 0, 0, 0, 0, time.UTC),
		time.Date(1900, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	tab.Str["species"] = []string{"Boletus edulis", "", "x", "y"}
	tab.Bool["flag"] = []bool{true, false, true, false}
	tab.Null["species"] = []bool{false, true, false, false}
	tab.Null["date"] = []bool{false, false, true, false}
	return tab
}

func TestParquetRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "w.parquet")
	src := sampleTable()
	if err := WriteParquet(path, src, weatherSchema); err != nil {
		t.Fatal(err)
	}
	info, err := Inspect(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Rows != 4 || !slices.Equal(info.Columns, weatherSchema) {
		t.Errorf("inspect = %+v", info)
	}
	got, err := ReadParquet(path, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"iso_year", "iso_week", "gx", "cell_x"} {
		if !slices.Equal(got.I64[name], src.I64[name]) {
			t.Errorf("%s = %v, want %v", name, got.I64[name], src.I64[name])
		}
	}
	if !slices.Equal(got.Str["cell"], src.Str["cell"]) || !slices.Equal(got.Bool["flag"], src.Bool["flag"]) {
		t.Errorf("cell/flag differ: %v %v", got.Str["cell"], got.Bool["flag"])
	}
	if !slices.Equal(got.Null["species"], src.Null["species"]) || !slices.Equal(got.Null["date"], src.Null["date"]) {
		t.Errorf("null masks differ: %v %v", got.Null["species"], got.Null["date"])
	}
	for i := range 4 {
		if a, b := got.F32["pr"][i], src.F32["pr"][i]; math.Float32bits(a) != math.Float32bits(b) && !(a != a && b != b) {
			t.Errorf("pr[%d] = %v, want %v", i, a, b)
		}
		if a, b := got.F64["x"][i], src.F64["x"][i]; a != b && !(a != a && b != b) {
			t.Errorf("x[%d] = %v, want %v", i, a, b)
		}
		if !got.Time["day"][i].Equal(src.Time["day"][i]) {
			t.Errorf("day[%d] = %v", i, got.Time["day"][i])
		}
		if !src.Null["date"][i] && !got.Time["date"][i].Equal(src.Time["date"][i]) {
			t.Errorf("date[%d] = %v", i, got.Time["date"][i])
		}
	}
}

func TestWriteParquetErrors(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "bad.parquet")
	tab := NewTable(2)
	tab.I64["w"] = []int64{1, 200}
	if err := WriteParquet(path, tab, []ColumnSpec{{"w", Int8}}); err == nil {
		t.Error("int8 overflow gives no error")
	}
	if err := WriteParquet(path, tab, []ColumnSpec{{"v", Float32}}); err == nil {
		t.Error("missing column gives no error")
	}
	if err := WriteParquet(path, tab, []ColumnSpec{{"w", Int64}, {"w", Int64}}); err == nil {
		t.Error("duplicate column gives no error")
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 0 {
		t.Errorf("failed writes left files: %v", entries)
	}
}

func TestRequireColumns(t *testing.T) {
	path := "testdata/pandas_types.parquet"
	ok := []ColumnSpec{{"iso_year", Int16}, {"iso_week", Int8}, {"cell", String}, {"pr", Float32},
		{"x", Float64}, {"date", Timestamp}, {"gx", Any}}
	if err := RequireColumns(path, ok); err != nil {
		t.Fatal(err)
	}
	err := RequireColumns(path, []ColumnSpec{{"pr", Float64}, {"tas", Float32}, {"cell", String}})
	var se *SchemaError
	if !errors.As(err, &se) || len(se.Problems) != 2 {
		t.Fatalf("err = %v, want two problems", err)
	}
}

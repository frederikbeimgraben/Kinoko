package occ

import (
	"fmt"
	"math"
	"slices"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// Schema is the column set of occurrences.parquet that WriteOccurrences writes.
// It is the part of the Python table that the later steps read; the other
// GBIF columns (datasetKey, license, taxonomy) are not kept.
var Schema = []pio.ColumnSpec{
	{Name: "gbifID", Type: pio.String},
	{Name: "species", Type: pio.String},
	{Name: "class", Type: pio.String},
	{Name: "decimalLatitude", Type: pio.Float64},
	{Name: "decimalLongitude", Type: pio.Float64},
	{Name: "coordinateUncertaintyInMeters", Type: pio.Float64},
	{Name: "recordedByHash", Type: pio.String},
	{Name: "basis", Type: pio.String},
	{Name: "date", Type: pio.Timestamp},
	{Name: "iso_year", Type: pio.Int16},
	{Name: "iso_week", Type: pio.Int8},
	{Name: "doy", Type: pio.Int16},
	{Name: "x", Type: pio.Float64},
	{Name: "y", Type: pio.Float64},
	{Name: "cell_x", Type: pio.Int32},
	{Name: "cell_y", Type: pio.Int32},
	{Name: "cell", Type: pio.String},
}

// readColumns are the columns that ReadOccurrences needs. A Python file has them too.
var readColumns = []string{"gbifID", "species", "decimalLatitude", "decimalLongitude",
	"coordinateUncertaintyInMeters", "recordedByHash", "date", "x", "y", "cell"}

// WriteOccurrences writes the records to path in Schema.
func WriteOccurrences(path string, rs []Record) error {
	t := pio.NewTable(len(rs))
	str := func(name string, get func(Record) string, nullIfEmpty bool) {
		vals, mask := make([]string, len(rs)), make([]bool, len(rs))
		for i, r := range rs {
			vals[i] = get(r)
			mask[i] = nullIfEmpty && vals[i] == ""
		}
		t.Str[name] = vals
		if nullIfEmpty {
			t.Null[name] = mask
		}
	}
	f64 := func(name string, get func(Record) float64) {
		vals := make([]float64, len(rs))
		for i, r := range rs {
			vals[i] = get(r)
		}
		t.F64[name] = vals
	}
	i64 := func(name string, get func(Record) int64) {
		vals := make([]int64, len(rs))
		for i, r := range rs {
			vals[i] = get(r)
		}
		t.I64[name] = vals
	}
	str("gbifID", func(r Record) string { return r.GBIFID }, false)
	str("species", func(r Record) string { return r.Species }, true)
	str("class", func(Record) string { return TargetClass }, false)
	f64("decimalLatitude", func(r Record) float64 { return r.Lat })
	f64("decimalLongitude", func(r Record) float64 { return r.Lon })
	f64("coordinateUncertaintyInMeters", func(r Record) float64 { return r.Uncertainty })
	str("recordedByHash", func(r Record) string { return r.Observer }, true)
	str("basis", func(r Record) string { return r.Basis }, false)
	t.Time["date"] = make([]time.Time, len(rs))
	for i, r := range rs {
		t.Time["date"][i] = r.Date
	}
	i64("iso_year", func(r Record) int64 { return int64(r.ISOYear) })
	i64("iso_week", func(r Record) int64 { return int64(r.ISOWeek) })
	i64("doy", func(r Record) int64 { return int64(r.DOY) })
	f64("x", func(r Record) float64 { return r.X })
	f64("y", func(r Record) float64 { return r.Y })
	i64("cell_x", func(r Record) int64 { return int64(r.Cell.X) })
	i64("cell_y", func(r Record) int64 { return int64(r.Cell.Y) })
	str("cell", func(r Record) string { return r.Cell.String() }, false)
	return pio.WriteParquet(path, t, Schema)
}

// ReadOccurrences reads an occurrences.parquet of WriteOccurrences or of build_occurrences.py.
// A file without a basis column holds GBIF rows only, as visit_model.build_visits assumes.
func ReadOccurrences(path string) ([]Record, error) {
	info, err := pio.Inspect(path)
	if err != nil {
		return nil, err
	}
	cols := readColumns
	hasBasis := info.Require([]pio.ColumnSpec{{Name: "basis", Type: pio.Any}}) == nil
	if hasBasis {
		cols = slices.Concat(readColumns, []string{"basis"})
	}
	t, err := pio.ReadParquet(path, cols)
	if err != nil {
		return nil, err
	}
	out := make([]Record, t.N)
	for i := range out {
		cell, err := geo.ParseCellKey(t.Str["cell"][i])
		if err != nil {
			return nil, fmt.Errorf("occ: %s row %d: %w", path, i, err)
		}
		r := Record{
			GBIFID:      t.Str["gbifID"][i],
			Species:     nullable(t, "species", i),
			Observer:    nullable(t, "recordedByHash", i),
			Basis:       BasisGBIF,
			Lat:         t.F64["decimalLatitude"][i],
			Lon:         t.F64["decimalLongitude"][i],
			Uncertainty: floatOrNaN(t, "coordinateUncertaintyInMeters", i),
			X:           t.F64["x"][i],
			Y:           t.F64["y"][i],
			Cell:        cell,
		}
		if hasBasis {
			r.Basis = t.Str["basis"][i]
		}
		out[i] = withTime(r, t.Time["date"][i].UTC())
	}
	return out, nil
}

func nullable(t *pio.Table, name string, i int) string {
	if t.IsNull(name, i) {
		return ""
	}
	return t.Str[name][i]
}

// floatOrNaN reads a float column that pandas may have written as object (all null) or as float64.
func floatOrNaN(t *pio.Table, name string, i int) float64 {
	if v, ok := t.F64[name]; ok {
		return v[i]
	}
	if v, ok := t.F32[name]; ok {
		return float64(v[i])
	}
	return math.NaN()
}

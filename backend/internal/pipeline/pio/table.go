// Package pio reads and writes the files of the forecast pipeline.
// It holds parquet tables with pandas types, netCDF grids with CF
// decoding, a raster probe and the HTTP client of the fetchers. Package
// pio/archive reads upload archives.
package pio

import (
	"fmt"
	"time"
)

// ColType is the pandas dtype of a parquet column.
type ColType int

// Column types. Each type maps to one field of Table.
const (
	Any       ColType = iota // RequireColumns accepts each type.
	String                   // Table.Str, pandas object or category.
	Bool                     // Table.Bool, pandas bool.
	Int8                     // Table.I64, INT32 with INT(8).
	Int16                    // Table.I64, INT32 with INT(16).
	Int32                    // Table.I64, INT32.
	Int64                    // Table.I64, INT64.
	Float32                  // Table.F32, FLOAT.
	Float64                  // Table.F64, DOUBLE.
	Timestamp                // Table.Time, TIMESTAMP(ns) not adjusted to UTC.
	Date                     // Table.Time, DATE (days since 1970-01-01).
)

var colTypeNames = map[ColType]string{
	Any: "any", String: "string", Bool: "bool", Int8: "int8", Int16: "int16",
	Int32: "int32", Int64: "int64", Float32: "float32", Float64: "float64",
	Timestamp: "datetime64[ns]", Date: "date",
}

// String gives the pandas name of the type.
func (c ColType) String() string {
	if name, ok := colTypeNames[c]; ok {
		return name
	}
	return fmt.Sprintf("ColType(%d)", int(c))
}

// IsInt tells if the type is stored in Table.I64.
func (c ColType) IsInt() bool { return c >= Int8 && c <= Int64 }

// ColumnSpec names a column and its type.
type ColumnSpec struct {
	Name string
	Type ColType
}

// Table holds named columns of equal length N.
// Float nulls read as NaN. For other types, Null marks the null rows
// of each column that holds at least one null.
type Table struct {
	N    int
	Str  map[string][]string
	F32  map[string][]float32
	F64  map[string][]float64
	I64  map[string][]int64
	Bool map[string][]bool
	Time map[string][]time.Time
	Null map[string][]bool
}

// NewTable gives an empty table with n rows and allocated maps.
func NewTable(n int) *Table {
	return &Table{
		N:    n,
		Str:  map[string][]string{},
		F32:  map[string][]float32{},
		F64:  map[string][]float64{},
		I64:  map[string][]int64{},
		Bool: map[string][]bool{},
		Time: map[string][]time.Time{},
		Null: map[string][]bool{},
	}
}

// IsNull tells if row i of column name is null.
// It does not look at NaN in float columns.
func (t *Table) IsNull(name string, i int) bool {
	mask, ok := t.Null[name]
	return ok && mask[i]
}

// columnLen gives the length of a column of the given type, or -1 if the column is missing.
func (t *Table) columnLen(spec ColumnSpec) int {
	var n int
	var ok bool
	switch {
	case spec.Type == String:
		n, ok = lenOf(t.Str, spec.Name)
	case spec.Type == Bool:
		n, ok = lenOf(t.Bool, spec.Name)
	case spec.Type.IsInt():
		n, ok = lenOf(t.I64, spec.Name)
	case spec.Type == Float32:
		n, ok = lenOf(t.F32, spec.Name)
	case spec.Type == Float64:
		n, ok = lenOf(t.F64, spec.Name)
	case spec.Type == Timestamp || spec.Type == Date:
		n, ok = lenOf(t.Time, spec.Name)
	}
	if !ok {
		return -1
	}
	return n
}

func lenOf[T any](m map[string][]T, name string) (int, bool) {
	values, ok := m[name]
	return len(values), ok
}

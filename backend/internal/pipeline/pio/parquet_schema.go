package pio

import (
	"fmt"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// ParquetInfo describes a parquet file: its row count and its top-level columns in file order.
type ParquetInfo struct {
	Rows    int64
	Columns []ColumnSpec
}

// Inspect reads the footer of a parquet file. It reads no column data.
// A column of a type that pio cannot read has the type Any.
func Inspect(path string) (ParquetInfo, error) {
	f, pf, err := openParquet(path)
	if err != nil {
		return ParquetInfo{}, err
	}
	defer f.Close()
	info := ParquetInfo{Rows: pf.NumRows()}
	for _, col := range pf.Root().Columns() {
		ct := Any
		if col.Leaf() && col.MaxRepetitionLevel() == 0 {
			if ci, err := fileColInfo(col); err == nil {
				ct = ci.typ
			}
		}
		info.Columns = append(info.Columns, ColumnSpec{Name: col.Name(), Type: ct})
	}
	return info, nil
}

// RequireColumns checks that the parquet file has each column of specs with its type.
// A spec of type Any accepts each type. The error lists each missing or wrong column.
func RequireColumns(path string, specs []ColumnSpec) error {
	info, err := Inspect(path)
	if err != nil {
		return err
	}
	return info.Require(specs)
}

// Require checks the columns of the file against specs. See RequireColumns.
func (p ParquetInfo) Require(specs []ColumnSpec) error {
	have := make(map[string]ColType, len(p.Columns))
	for _, c := range p.Columns {
		have[c.Name] = c.Type
	}
	var errs []error
	for _, spec := range specs {
		got, ok := have[spec.Name]
		switch {
		case !ok:
			errs = append(errs, fmt.Errorf("column %q is missing", spec.Name))
		case spec.Type != Any && got != spec.Type:
			errs = append(errs, fmt.Errorf("column %q has type %s, expected %s", spec.Name, got, spec.Type))
		}
	}
	if len(errs) > 0 {
		return &SchemaError{Problems: errs}
	}
	return nil
}

// SchemaError tells which columns of a parquet file do not agree with the expected schema.
type SchemaError struct {
	Problems []error
}

// Error joins the problems in one message.
func (e *SchemaError) Error() string {
	return "pio: schema check failed: " + strings.Join(fn.Map(e.Problems, error.Error), "; ")
}

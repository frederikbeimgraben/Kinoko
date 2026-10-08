package sources

import (
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"slices"
	"strings"

	"github.com/parquet-go/parquet-go"
)

// table is an open parquet file for the schema checks. It reads the footer
// at open and reads a column only when a check asks for it.
type table struct {
	file *os.File
	pf   *parquet.File
}

func openTable(path string) (*table, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, err
	}
	pf, err := parquet.OpenFile(file, info.Size(), parquet.SkipPageIndex(true), parquet.SkipBloomFilters(true))
	if err != nil {
		_ = file.Close()
		return nil, Fail("parquet", "the file is not a parquet file: %v", err)
	}
	return &table{file: file, pf: pf}, nil
}

func (t *table) Close() error { return t.file.Close() }

func (t *table) rows() int64 { return t.pf.NumRows() }

// names gives the top-level columns in file order.
func (t *table) names() []string {
	out := []string{}
	for _, c := range t.pf.Root().Columns() {
		out = append(out, c.Name())
	}
	return out
}

// require fails with the list of the columns that the file does not have.
func (t *table) require(names []string) error {
	have := t.names()
	missing := slices.DeleteFunc(slices.Clone(names), func(n string) bool { return slices.Contains(have, n) })
	if len(missing) > 0 {
		return Fail("schema", "missing columns: %s", strings.Join(missing, ", "))
	}
	return nil
}

// requireFloat32 fails with the list of the columns that are not float32.
func (t *table) requireFloat32(names []string) error {
	wrong := slices.DeleteFunc(slices.Clone(names), func(n string) bool {
		c := t.pf.Root().Column(n)
		return c != nil && c.Leaf() && c.Type().Kind() == parquet.Float
	})
	if len(wrong) > 0 {
		return Fail("schema", "columns are not float32: %s", strings.Join(wrong, ", "))
	}
	return nil
}

// each calls f with each value of a top-level leaf column, in row order.
func (t *table) each(name string, f func(parquet.Value)) error {
	col := t.pf.Root().Column(name)
	if col == nil || !col.Leaf() || col.MaxRepetitionLevel() > 0 {
		return Fail("schema", "column %q is missing or nested", name)
	}
	buf := make([]parquet.Value, 4096)
	for _, group := range t.pf.RowGroups() {
		if err := eachInChunk(group.ColumnChunks()[col.Index()], buf, f); err != nil {
			return fmt.Errorf("column %q: %w", name, err)
		}
	}
	return nil
}

func eachInChunk(chunk parquet.ColumnChunk, buf []parquet.Value, f func(parquet.Value)) error {
	pages := chunk.Pages()
	defer func() { _ = pages.Close() }()
	for {
		page, err := pages.ReadPage()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		err = eachInPage(page, buf, f)
		parquet.Release(page)
		if err != nil {
			return err
		}
	}
}

func eachInPage(page parquet.Page, buf []parquet.Value, f func(parquet.Value)) error {
	values := page.Values()
	for {
		n, err := values.ReadValues(buf)
		for _, v := range buf[:n] {
			f(v)
		}
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
	}
}

// number gives a numeric value as float64. Null gives NaN.
func number(v parquet.Value) float64 {
	if v.IsNull() {
		return math.NaN()
	}
	switch v.Kind() {
	case parquet.Int32:
		return float64(v.Int32())
	case parquet.Int64:
		return float64(v.Int64())
	case parquet.Float:
		return float64(v.Float())
	case parquet.Double:
		return v.Double()
	case parquet.Boolean:
		if v.Boolean() {
			return 1
		}
		return 0
	default:
		return math.NaN()
	}
}

func (t *table) numbers(name string) ([]float64, error) {
	out := make([]float64, 0, t.rows())
	err := t.each(name, func(v parquet.Value) { out = append(out, number(v)) })
	return out, err
}

func (t *table) texts(name string) ([]string, error) {
	out := make([]string, 0, t.rows())
	err := t.each(name, func(v parquet.Value) {
		if v.IsNull() {
			out = append(out, "")
			return
		}
		out = append(out, string(v.ByteArray()))
	})
	return out, err
}

// firstDuplicate gives a value that occurs twice, or false.
func firstDuplicate(values []string) (string, bool) {
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			return value, true
		}
		seen[value] = struct{}{}
	}
	return "", false
}

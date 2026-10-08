package pio

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/parquet-go/parquet-go"
)

// readBatch is the number of values read from a page in one call.
const readBatch = 4096

// pandasIndexPrefix starts the name of an index column that pandas writes.
const pandasIndexPrefix = "__index_level_"

// ReadParquet reads the named columns of a parquet file into one table.
// A nil columns list reads each top-level column except pandas index columns.
func ReadParquet(path string, columns []string) (*Table, error) {
	f, pf, err := openParquet(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	cols, err := projection(pf, columns)
	if err != nil {
		return nil, fmt.Errorf("pio: %s: %w", path, err)
	}
	t, err := readRowGroups(pf.RowGroups(), cols, int(pf.NumRows()))
	if err != nil {
		return nil, fmt.Errorf("pio: %s: %w", path, err)
	}
	return t, nil
}

// ScanParquet reads the named columns one row group at a time and gives each group to fn.
// Use it for tables that are too large to keep in memory. An error from fn stops the scan.
func ScanParquet(path string, columns []string, fn func(*Table) error) error {
	f, pf, err := openParquet(path)
	if err != nil {
		return err
	}
	defer f.Close()
	cols, err := projection(pf, columns)
	if err != nil {
		return fmt.Errorf("pio: %s: %w", path, err)
	}
	for _, rg := range pf.RowGroups() {
		t, err := readRowGroups([]parquet.RowGroup{rg}, cols, int(rg.NumRows()))
		if err != nil {
			return fmt.Errorf("pio: %s: %w", path, err)
		}
		if err := fn(t); err != nil {
			return err
		}
	}
	return nil
}

func openParquet(path string) (*os.File, *parquet.File, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, fmt.Errorf("pio: %w", err)
	}
	st, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, nil, fmt.Errorf("pio: %w", err)
	}
	pf, err := parquet.OpenFile(f, st.Size(), parquet.SkipPageIndex(true), parquet.SkipBloomFilters(true))
	if err != nil {
		f.Close()
		return nil, nil, fmt.Errorf("pio: %s: %w", path, err)
	}
	return f, pf, nil
}

// projected is one column to read, with its leaf index in the file.
type projected struct {
	name  string
	index int
	info  colInfo
}

// projection finds the requested top-level leaf columns of the file.
func projection(pf *parquet.File, columns []string) ([]projected, error) {
	root := pf.Root()
	names := columns
	if names == nil {
		for _, c := range root.Columns() {
			if !strings.HasPrefix(c.Name(), pandasIndexPrefix) {
				names = append(names, c.Name())
			}
		}
	}
	out := make([]projected, 0, len(names))
	for _, name := range names {
		col := root.Column(name)
		if col == nil {
			return nil, fmt.Errorf("column %q not found", name)
		}
		if !col.Leaf() || col.MaxRepetitionLevel() > 0 {
			return nil, fmt.Errorf("column %q is nested or repeated", name)
		}
		info, err := fileColInfo(col)
		if err != nil {
			return nil, err
		}
		out = append(out, projected{name: name, index: col.Index(), info: info})
	}
	return out, nil
}

func readRowGroups(groups []parquet.RowGroup, cols []projected, n int) (*Table, error) {
	t := NewTable(n)
	buf := make([]parquet.Value, readBatch)
	for _, c := range cols {
		a := newAccumulator(c.info, n)
		for _, rg := range groups {
			if err := readChunk(rg.ColumnChunks()[c.index], a, buf); err != nil {
				return nil, fmt.Errorf("column %q: %w", c.name, err)
			}
		}
		a.store(t, c.name)
		if got := t.columnLen(ColumnSpec{Name: c.name, Type: c.info.typ}); got != n {
			return nil, fmt.Errorf("column %q: %d values for %d rows", c.name, got, n)
		}
	}
	return t, nil
}

func readChunk(chunk parquet.ColumnChunk, a accumulator, buf []parquet.Value) error {
	pages := chunk.Pages()
	defer pages.Close()
	for {
		page, err := pages.ReadPage()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		err = readPage(page, a, buf)
		parquet.Release(page)
		if err != nil {
			return err
		}
	}
}

func readPage(page parquet.Page, a accumulator, buf []parquet.Value) error {
	values := page.Values()
	for {
		n, err := values.ReadValues(buf)
		for _, v := range buf[:n] {
			a.add(v)
		}
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
	}
}

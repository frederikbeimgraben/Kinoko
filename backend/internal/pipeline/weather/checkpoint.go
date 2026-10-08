package weather

import (
	"cmp"
	"fmt"
	"path/filepath"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// rows is a weekly checkpoint in long form: one row per cell-week.
type rows struct {
	weeks []calendar.Week
	cells []string
	vals  []float32
}

func (r *rows) add(w calendar.Week, cell string, v float32) {
	r.weeks, r.cells, r.vals = append(r.weeks, w), append(r.cells, cell), append(r.vals, v)
}

// sorted returns the rows ordered by (iso_year, iso_week, cell), the order of
// a pandas groupby on these keys. The sort is stable.
func (r rows) sorted() rows {
	idx := make([]int, len(r.vals))
	for i := range idx {
		idx[i] = i
	}
	slices.SortStableFunc(idx, func(a, b int) int {
		return cmp.Or(cmp.Compare(r.weeks[a].Year, r.weeks[b].Year),
			cmp.Compare(r.weeks[a].Week, r.weeks[b].Week), cmp.Compare(r.cells[a], r.cells[b]))
	})
	out := rows{weeks: make([]calendar.Week, len(idx)), cells: make([]string, len(idx)), vals: make([]float32, len(idx))}
	for i, j := range idx {
		out.weeks[i], out.cells[i], out.vals[i] = r.weeks[j], r.cells[j], r.vals[j]
	}
	return out
}

// CheckpointPath returns the path of the weekly checkpoint of name in dir.
func CheckpointPath(dir, name string) string { return filepath.Join(dir, name+".parquet") }

// checkpointSchema gives the columns of weekly/<name>.parquet. The keys use the
// types of the merged table; extract_grids.py writes them as uint32.
func checkpointSchema(name string) []pio.ColumnSpec {
	return []pio.ColumnSpec{{Name: "iso_year", Type: pio.Int16}, {Name: "iso_week", Type: pio.Int8},
		{Name: "cell", Type: pio.String}, {Name: name, Type: pio.Float32}}
}

func writeCheckpoint(path, name string, r rows) error {
	t := pio.NewTable(len(r.vals))
	years, weeks := make([]int64, len(r.vals)), make([]int64, len(r.vals))
	for i, w := range r.weeks {
		years[i], weeks[i] = int64(w.Year), int64(w.Week)
	}
	t.I64["iso_year"], t.I64["iso_week"], t.Str["cell"], t.F32[name] = years, weeks, r.cells, r.vals
	return pio.WriteParquet(path, t, checkpointSchema(name))
}

// readCheckpoint reads the rows of a checkpoint that keep accepts, in file order.
// It shares one string per distinct cell, so that ten million rows stay small.
func readCheckpoint(path, name string, keep func(calendar.Week) bool) (rows, error) {
	var out rows
	intern := map[string]string{}
	err := pio.ScanParquet(path, []string{"iso_year", "iso_week", "cell", name}, func(t *pio.Table) error {
		years, weeks, cells := t.I64["iso_year"], t.I64["iso_week"], t.Str["cell"]
		vals, err := floatColumn(t, name)
		if err != nil {
			return err
		}
		if years == nil || weeks == nil || cells == nil {
			return fmt.Errorf("weather: %s: key columns iso_year, iso_week, cell are not integer and text", path)
		}
		for i := range t.N {
			w := calendar.Week{Year: int(years[i]), Week: int(weeks[i])}
			if keep != nil && !keep(w) {
				continue
			}
			c, ok := intern[cells[i]]
			if !ok {
				c = cells[i]
				intern[c] = c
			}
			out.add(w, c, vals[i])
		}
		return nil
	})
	if err != nil {
		return rows{}, err
	}
	return out, nil
}

// floatColumn returns column name as float32. A float64 column is narrowed, as merge_weekly.py does.
func floatColumn(t *pio.Table, name string) ([]float32, error) {
	if v, ok := t.F32[name]; ok {
		return v, nil
	}
	if v, ok := t.F64[name]; ok {
		out := make([]float32, len(v))
		for i, x := range v {
			out[i] = float32(x)
		}
		return out, nil
	}
	return nil, fmt.Errorf("weather: column %s is not a float column", name)
}

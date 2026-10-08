package weather

import (
	"cmp"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// LoadOption narrows what LoadCube reads.
type LoadOption func(*loadConfig)

type loadConfig struct {
	cells   map[string]bool
	allKeys bool
}

// OnlyCells keeps only the given cells. Use it to save memory when a run needs few cells.
func OnlyCells(cells []geo.CellKey) LoadOption {
	return func(c *loadConfig) {
		c.cells = make(map[string]bool, len(cells))
		for _, k := range cells {
			c.cells[k.String()] = true
		}
	}
}

// KeysOfAll takes the cells and the weeks from each checkpoint in the folder, also when vars
// names only some. A narrow cube then has the cells and the weeks of the full cube.
func KeysOfAll() LoadOption { return func(c *loadConfig) { c.allKeys = true } }

// LoadCube reads the checkpoints of vars (each *.parquet in dir when vars is nil)
// into one Cube. It is an outer join: a cell-week that a checkpoint lacks is NaN.
// merge_weekly.py stops when the keys differ (bug 3); the cube keeps the other variables.
func LoadCube(checkpointDir string, vars []string, opts ...LoadOption) (*Cube, error) {
	var cfg loadConfig
	for _, o := range opts {
		o(&cfg)
	}
	if vars == nil {
		var err error
		if vars, err = checkpointNames(checkpointDir); err != nil {
			return nil, err
		}
	}
	keyVars := vars
	if cfg.allKeys {
		var err error
		if keyVars, err = checkpointNames(checkpointDir); err != nil {
			return nil, err
		}
	}
	keys, err := scanKeys(checkpointDir, keyVars, cfg)
	if err != nil {
		return nil, err
	}
	nc := len(keys.cells)
	cells := make([]geo.CellKey, nc)
	cellPos := make(map[string]int, nc)
	for i, s := range keys.cells {
		if cells[i], err = geo.ParseCellKey(s); err != nil {
			return nil, fmt.Errorf("weather: %w", err)
		}
		cellPos[s] = i
	}
	weeks := keys.weekRun()
	weekPos := make(map[calendar.Week]int, len(weeks))
	for i, w := range weeks {
		weekPos[w] = i
	}
	out := make(map[string][]float32, len(vars))
	for _, name := range vars {
		vals := make([]float32, len(weeks)*nc)
		for i := range vals {
			vals[i] = nan32
		}
		err := pio.ScanParquet(CheckpointPath(checkpointDir, name), []string{"iso_year", "iso_week", "cell", name},
			func(t *pio.Table) error {
				col, err := floatColumn(t, name)
				if err != nil {
					return err
				}
				for i := range t.N {
					c, ok := cellPos[t.Str["cell"][i]]
					if !ok {
						continue
					}
					w := weekPos[calendar.Week{Year: int(t.I64["iso_year"][i]), Week: int(t.I64["iso_week"][i])}]
					vals[w*nc+c] = col[i]
				}
				return nil
			})
		if err != nil {
			return nil, err
		}
		out[name] = vals
	}
	return NewCube(cells, weeks, out), nil
}

// checkpointNames returns the stems of the parquet files in dir, sorted.
func checkpointNames(dir string) ([]string, error) {
	found, err := filepath.Glob(filepath.Join(dir, "*.parquet"))
	if err != nil {
		return nil, err
	}
	if len(found) == 0 {
		return nil, fmt.Errorf("weather: no checkpoint files in %s", dir)
	}
	names := make([]string, len(found))
	for i, f := range found {
		names[i] = strings.TrimSuffix(filepath.Base(f), ".parquet")
	}
	slices.Sort(names)
	return names, nil
}

// keySet is the union of the keys of the checkpoints.
type keySet struct {
	cells       []string
	first, last calendar.Week
	any         bool
}

// weekRun returns each calendar week from first to last.
func (k keySet) weekRun() []calendar.Week {
	if !k.any {
		return nil
	}
	n := calendar.Distance(k.first, k.last)
	out := make([]calendar.Week, 0, n+1)
	for i := 0; i <= n; i++ {
		out = append(out, k.first.AddWeeks(i))
	}
	return out
}

func scanKeys(dir string, vars []string, cfg loadConfig) (keySet, error) {
	var ks keySet
	seen := map[string]bool{}
	checked := map[calendar.Week]bool{}
	for _, name := range vars {
		path := CheckpointPath(dir, name)
		if _, err := os.Stat(path); err != nil {
			return keySet{}, fmt.Errorf("weather: checkpoint %s: %w", name, err)
		}
		err := pio.ScanParquet(path, []string{"iso_year", "iso_week", "cell"}, func(t *pio.Table) error {
			years, weeks, cells := t.I64["iso_year"], t.I64["iso_week"], t.Str["cell"]
			if years == nil || weeks == nil || cells == nil {
				return fmt.Errorf("weather: %s: key columns iso_year, iso_week, cell are not integer and text", path)
			}
			for i := range t.N {
				if cfg.cells != nil && !cfg.cells[cells[i]] {
					continue
				}
				if !seen[cells[i]] {
					seen[cells[i]] = true
					ks.cells = append(ks.cells, cells[i])
				}
				w := calendar.Week{Year: int(years[i]), Week: int(weeks[i])}
				if !checked[w] {
					if !w.Valid() {
						return fmt.Errorf("weather: %s: week %d-%d does not exist", path, w.Year, w.Week)
					}
					checked[w] = true
				}
				if !ks.any || w.Before(ks.first) {
					ks.first = w
				}
				if !ks.any || ks.last.Before(w) {
					ks.last = w
				}
				ks.any = true
			}
			return nil
		})
		if err != nil {
			return keySet{}, err
		}
	}
	slices.Sort(ks.cells)
	return ks, nil
}

// WriteMerged writes the observed weeks of c as weather_weekly.parquet: iso_year
// int16, iso_week int8, cell, then each variable as float32 in name order,
// sorted by (iso_year, iso_week, cell) as merge_weekly.py writes it.
func WriteMerged(path string, c *Cube) error {
	order := make([]int, len(c.Cells))
	for i := range order {
		order[i] = i
	}
	names := cellNames(c.Cells)
	slices.SortFunc(order, func(a, b int) int { return cmp.Compare(names[a], names[b]) })
	vars := make([]string, 0, len(c.Vars))
	for v := range c.Vars {
		vars = append(vars, v)
	}
	slices.Sort(vars)
	n := c.observed * len(c.Cells)
	t := pio.NewTable(n)
	years, weeks, cells := make([]int64, 0, n), make([]int64, 0, n), make([]string, 0, n)
	for _, w := range c.Weeks[:c.observed] {
		for _, i := range order {
			years, weeks, cells = append(years, int64(w.Year)), append(weeks, int64(w.Week)), append(cells, names[i])
		}
	}
	t.I64["iso_year"], t.I64["iso_week"], t.Str["cell"] = years, weeks, cells
	schema := []pio.ColumnSpec{{Name: "iso_year", Type: pio.Int16}, {Name: "iso_week", Type: pio.Int8},
		{Name: "cell", Type: pio.String}}
	for _, v := range vars {
		col := make([]float32, 0, n)
		for w := range c.observed {
			for _, i := range order {
				col = append(col, c.Vars[v][w*len(c.Cells)+i])
			}
		}
		t.F32[v] = col
		schema = append(schema, pio.ColumnSpec{Name: v, Type: pio.Float32})
	}
	return pio.WriteParquet(path, t, schema)
}

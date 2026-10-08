// Package fit trains the model of one species, as visit_model.py --quick and final_model.py do together.
// It builds the visit table, ranks and prunes the features, tunes the settings with blocked folds,
// calibrates out of fold and returns a bundle.Bundle and a Report.
package fit

import (
	"context"
	"fmt"
	"math"
	"slices"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/horizons"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/train"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/visits"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
)

// WeatherSource gives the weekly weather cube of the cells. The cube must hold pr, tas and tasmin.
// The anomalies use the normals of the returned cube, so give the full record of each cell.
type WeatherSource interface {
	Cube(ctx context.Context, cells []geo.CellKey) (*weather.Cube, error)
}

// CubeWeather is a WeatherSource over a cube that is already in memory.
type CubeWeather struct{ All *weather.Cube }

// Cube returns the cells of the cube over all its weeks.
func (c CubeWeather) Cube(_ context.Context, cells []geo.CellKey) (*weather.Cube, error) {
	if c.All == nil || len(c.All.Weeks) == 0 {
		return nil, fmt.Errorf("fit: the weather cube has no weeks")
	}
	return c.All.Restrict(cells, c.All.Weeks[0]), nil
}

// CheckpointWeather is a WeatherSource that reads the weekly checkpoints of Dir with weather.LoadCube.
type CheckpointWeather struct{ Dir string }

// Cube reads pr, tas and tasmin of the cells.
func (c CheckpointWeather) Cube(_ context.Context, cells []geo.CellKey) (*weather.Cube, error) {
	return weather.LoadCube(c.Dir, weather.LagVars, weather.OnlyCells(cells))
}

// TreeScales is tree_scales.parquet without x, y, cell_x and cell_y: one row per 500 m cell.
// Columns keeps the file order, because the trees block of the feature list keeps it too.
type TreeScales struct {
	Cells   []string
	Columns []string
	Values  map[string][]float32
}

// treeDrop are the columns that visit_model.py drops before the join.
var treeDrop = []string{"x", "y", "cell_x", "cell_y"}

// ReadTreeScales reads tree_scales.parquet. A float64 column becomes float32, as the file stores float32.
func ReadTreeScales(path string) (TreeScales, error) {
	info, err := pio.Inspect(path)
	if err != nil {
		return TreeScales{}, err
	}
	var names []string
	for _, c := range info.Columns {
		if c.Name != "cell" && !slices.Contains(treeDrop, c.Name) {
			names = append(names, c.Name)
		}
	}
	t, err := pio.ReadParquet(path, append([]string{"cell"}, names...))
	if err != nil {
		return TreeScales{}, err
	}
	out := TreeScales{Cells: t.Str["cell"], Columns: names, Values: map[string][]float32{}}
	if out.Cells == nil {
		return TreeScales{}, fmt.Errorf("fit: %s has no string column cell", path)
	}
	for _, name := range names {
		col, err := float32Column(t, name)
		if err != nil {
			return TreeScales{}, fmt.Errorf("fit: %s: %w", path, err)
		}
		out.Values[name] = col
	}
	return out, nil
}

func float32Column(t *pio.Table, name string) ([]float32, error) {
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
	return nil, fmt.Errorf("column %s is not a float column", name)
}

// lookup returns the row of each cell. The first row of a cell wins.
func (t TreeScales) lookup() map[string]int {
	out := make(map[string]int, len(t.Cells))
	for i, c := range t.Cells {
		if _, ok := out[c]; !ok {
			out[c] = i
		}
	}
	return out
}

// Inputs are the data of one training run. Records is the whole occurrence table; TrainSpecies applies
// the training filter of visit_model.py (MinYear, MaxUncertainty) to the visits and the activity alike.
type Inputs struct {
	Records    []occ.Record
	Weather    WeatherSource
	TreeScales TreeScales
}

// Config names the species and sets the run. The zero values take the defaults of visit_model.py and final_model.py.
type Config struct {
	Label   string   // the chain name, final_model.py --name
	Slug    string   // the catalogue slug; the finds layer and the bundle use it
	Species []string // the target taxa
	// Horizons are the horizons to train. Nil means horizons.Horizons.
	Horizons []int
	// Grid is GRID. Its first setting also ranks the features. Nil means train.Grid with Threads.
	Grid []train.Setting
	// Threads is num_threads of the default grid. Zero keeps the 8 of PARAMS.
	Threads        int
	MinSpecies     int
	MinYear        int
	MaxUncertainty float64
	// FindsDir is the folder of the finds layer <Slug>.json. Empty writes no file.
	FindsDir string
	Now      func() time.Time
	Log      func(format string, args ...any)
}

func (c Config) withDefaults() Config {
	if c.Horizons == nil {
		c.Horizons = horizons.Horizons
	}
	if c.Grid == nil {
		c.Grid = train.Grid()
		if c.Threads > 0 {
			c.Grid = train.WithThreads(c.Grid, c.Threads)
		}
	}
	if c.MinSpecies == 0 {
		c.MinSpecies = visits.MinSpecies
	}
	if c.MinYear == 0 {
		c.MinYear = visits.MinYear
	}
	if c.MaxUncertainty == 0 || math.IsNaN(c.MaxUncertainty) {
		c.MaxUncertainty = visits.MaxUncertainty
	}
	if c.Now == nil {
		c.Now = time.Now
	}
	if c.Log == nil {
		c.Log = func(string, ...any) {}
	}
	return c
}

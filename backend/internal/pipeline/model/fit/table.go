package fit

import (
	"context"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/horizons"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/train"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/activity"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/visits"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
)

// FineM is the edge of the cell_fine square of the tree join in metres.
const FineM = 500

// Blocks is the blocks JSON of visit_model.py: the feature names of each block, in table order.
type Blocks struct {
	Detection []string
	Season    []string
	Weather   []string
	Trees     []string
	Activity  map[int][]string
}

// Table is the prepared visit table of visit_model.py --save-prepared, one row per visit with weather.
// Columns holds each feature column as float64; a float32 column of Python keeps its float32 value.
type Table struct {
	N        int
	Keys     []string
	Label    []int8
	ISOYear  []int
	ISOWeek  []int
	NSpecies []int
	X, Y     []float64
	Lon, Lat []float64
	Date     []time.Time
	Cell     []string
	Block    []string
	Columns  map[string][]float64
	Blocks   Blocks
}

// TableStats counts the rows of each step of the table.
type TableStats struct {
	Records     int
	Visits      int
	Positives   int
	FromApp     int
	WithWeather int
}

// BuildTable builds the visit table as visit_model.main with --quick:
// the gated visits, the activity of each horizon, the tree scales, the weather join and the season columns.
func BuildTable(ctx context.Context, in Inputs, cfg Config) (*Table, TableStats, error) {
	cfg = cfg.withDefaults()
	records := occ.TrainingSet(in.Records, cfg.MinYear, cfg.MaxUncertainty)
	vs := visits.Build(records, cfg.Species, cfg.MinSpecies)
	stats := TableStats{Records: len(records), Visits: len(vs), Positives: visits.Positives(vs)}
	for _, v := range vs {
		stats.FromApp += int(v.FromApp)
	}
	if err := visits.CheckPositives(vs); err != nil {
		return nil, stats, err
	}
	fields, err := activity.New(records, cfg.Species, activity.BlockM)
	if err != nil {
		return nil, stats, err
	}
	cube, err := in.Weather.Cube(ctx, visitCells(vs))
	if err != nil {
		return nil, stats, err
	}
	weatherNames, derived, err := weatherFeatures(cube)
	if err != nil {
		return nil, stats, err
	}
	rows := joinWeather(vs, cube, derived)
	kept := pick(vs, rows)
	t := newTable(kept)
	t.Blocks = Blocks{Detection: visits.Detection, Season: visits.Season, Weather: weatherNames,
		Trees: in.TreeScales.Columns, Activity: map[int][]string{}}
	t.addDetectionAndSeason(kept)
	t.addActivity(fields, kept)
	t.addTrees(in.TreeScales)
	t.addWeather(weatherNames, derived, cube, kept)
	stats.WithWeather = t.N
	return t, stats, nil
}

func visitCells(vs []visits.Visit) []geo.CellKey {
	var out []geo.CellKey
	seen := map[geo.CellKey]bool{}
	for _, v := range vs {
		if !seen[v.Cell] {
			seen[v.Cell] = true
			out = append(out, v.Cell)
		}
	}
	return out
}

// weatherFeatures derives the 35 weather columns of add_lags and add_anomalies, in their column order.
// Deviation: weather.Derive stores the rolling sums, the means and the pr anomalies as float32;
// pandas keeps them float64. The rounding keeps the order of the values, so the LightGBM bins agree.
func weatherFeatures(cube *weather.Cube) ([]string, map[string][]float32, error) {
	for _, v := range weather.LagVars {
		if _, ok := cube.Vars[v]; !ok {
			return nil, nil, fmt.Errorf("fit: the weather cube lacks %s", v)
		}
	}
	names := append(weather.LagNames(), weather.AnomalyNames()...)
	derived, err := weather.Derive(cube, names)
	return names, derived, err
}

// joinWeather is the inner join on (cell, week_id) and the dropna over the lag columns.
// It returns the kept visit indices in visit order, as the merge of pandas keeps the left order.
func joinWeather(vs []visits.Visit, cube *weather.Cube, derived map[string][]float32) []int {
	weekIndex := make(map[calendar.Week]int, len(cube.Weeks))
	for w, wk := range cube.Weeks {
		weekIndex[wk] = w
	}
	var lags []string
	for name := range derived {
		if strings.Contains(name, "_lag") {
			lags = append(lags, name)
		}
	}
	var out []int
	for i, v := range vs {
		pos, ok := position(cube, weekIndex, v)
		if ok && !slices.ContainsFunc(lags, func(n string) bool { return math.IsNaN(float64(derived[n][pos])) }) {
			out = append(out, i)
		}
	}
	return out
}

// position returns the index of the cell-week of v in the derived columns.
func position(cube *weather.Cube, weekIndex map[calendar.Week]int, v visits.Visit) (int, bool) {
	c, ok := cube.Index(v.Cell)
	if !ok {
		return 0, false
	}
	w, ok := weekIndex[calendar.Week{Year: v.ISOYear, Week: v.ISOWeek}]
	if !ok {
		return 0, false
	}
	return w*len(cube.Cells) + c, true
}

func pick[T any](v []T, idx []int) []T {
	out := make([]T, len(idx))
	for i, j := range idx {
		out[i] = v[j]
	}
	return out
}

func newTable(vs []visits.Visit) *Table {
	n := len(vs)
	t := &Table{N: n, Keys: make([]string, n), Label: make([]int8, n), ISOYear: make([]int, n), ISOWeek: make([]int, n),
		NSpecies: make([]int, n), X: make([]float64, n), Y: make([]float64, n), Lon: make([]float64, n),
		Lat: make([]float64, n), Date: make([]time.Time, n), Cell: make([]string, n), Block: make([]string, n),
		Columns: map[string][]float64{}}
	for i, v := range vs {
		t.Keys[i], t.Label[i], t.ISOYear[i], t.ISOWeek[i], t.NSpecies[i] = v.Key, v.Label, v.ISOYear, v.ISOWeek, v.NSpecies
		t.X[i], t.Y[i], t.Lon[i], t.Lat[i], t.Date[i] = v.X, v.Y, v.Lon, v.Lat, v.Date
		t.Cell[i], t.Block[i] = v.Cell.String(), train.BlockKey(v.X, v.Y)
	}
	return t
}

func (t *Table) column(name string, value func(i int) float64) {
	col := make([]float64, t.N)
	for i := range col {
		col[i] = value(i)
	}
	t.Columns[name] = col
}

func (t *Table) addDetectionAndSeason(vs []visits.Visit) {
	t.column("n_records", func(i int) float64 { return float64(vs[i].NRecords) })
	t.column("n_species", func(i int) float64 { return float64(vs[i].NSpecies) })
	t.column("iso_week", func(i int) float64 { return float64(vs[i].ISOWeek) })
	t.column("week_sin", func(i int) float64 { s, _ := visits.WeekSinCos(vs[i].ISOWeek); return s })
	t.column("week_cos", func(i int) float64 { _, c := visits.WeekSinCos(vs[i].ISOWeek); return c })
}

// addActivity samples the activity of every horizon of horizons.Horizons, as visit_model.main does.
func (t *Table) addActivity(f *activity.Fields, vs []visits.Visit) {
	for _, h := range horizons.Horizons {
		for _, col := range f.Sample(t.X, t.Y, t.Date, h) {
			t.column(col.Name, func(i int) float64 { return float64(col.Values[i]) })
			t.Blocks.Activity[h] = append(t.Blocks.Activity[h], col.Name)
		}
	}
}

// addTrees is the left join of tree_scales on cell_fine; a visit without a fine cell reads NaN.
func (t *Table) addTrees(ts TreeScales) {
	index := ts.lookup()
	rows := make([]int, t.N)
	for i := range rows {
		rows[i] = -1
		if r, ok := index[FineCell(t.X[i], t.Y[i])]; ok {
			rows[i] = r
		}
	}
	for _, name := range ts.Columns {
		vals := ts.Values[name]
		t.column(name, func(i int) float64 {
			if rows[i] < 0 {
				return math.NaN()
			}
			return float64(vals[rows[i]])
		})
	}
}

// FineCell is cell_fine of visit_model.py: "<x // 500>_<y // 500>".
func FineCell(x, y float64) string {
	return strconv.Itoa(int(geo.FloorDiv(x, FineM))) + "_" + strconv.Itoa(int(geo.FloorDiv(y, FineM)))
}

func (t *Table) addWeather(names []string, derived map[string][]float32, cube *weather.Cube, vs []visits.Visit) {
	weekIndex := make(map[calendar.Week]int, len(cube.Weeks))
	for w, wk := range cube.Weeks {
		weekIndex[wk] = w
	}
	pos := make([]int, t.N)
	for i, v := range vs {
		pos[i], _ = position(cube, weekIndex, v)
	}
	for _, name := range names {
		vals := derived[name]
		t.column(name, func(i int) float64 { return float64(vals[pos[i]]) })
	}
}

// PriorRows returns the columns that train.Prior reads.
func (t *Table) PriorRows() train.Rows {
	return train.Rows{Cell: t.Cell, Block: t.Block, Year: t.ISOYear, Label: t.Label}
}

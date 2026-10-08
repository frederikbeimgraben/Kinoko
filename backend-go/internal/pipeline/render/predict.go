package render

import (
	"fmt"
	"math"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/numeric"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/activity"
)

// sourceKind is where a model column comes from, as the "quellen" of region_map.py.
type sourceKind int

const (
	fromGrid sourceKind = iota
	fromWeather
	fromActivity
	fromSeason
	fromConstant
	fromNothing
)

type source struct {
	kind  sourceKind
	name  string
	value float32 // fromConstant
}

// plan is the column plan of one horizon, in the column order of the booster.
type plan struct {
	h       int
	model   *bundle.Horizon
	sources []source
}

// newPlan maps each feature of hz to its source, in the order of region_map.py:
// grid, weather, activity, season, constants. A feature without a source stays NaN.
func newPlan(h int, hz *bundle.Horizon, fixed map[string][]float32, wnames []string, consts map[string]float32, log Logger) plan {
	p := plan{h: h, model: hz}
	for _, name := range hz.Features {
		s := source{name: name}
		switch {
		case fixed[name] != nil:
			s.kind = fromGrid
		case contains(wnames, name):
			s.kind = fromWeather
		case strings.HasPrefix(name, "activity_rate_"):
			s.kind = fromActivity
		case name == "iso_week" || name == "week_sin" || name == "week_cos":
			s.kind = fromSeason
		default:
			if v, ok := consts[name]; ok {
				s.kind, s.value = fromConstant, v
			} else {
				s.kind = fromNothing
				log.Printf("  WARNUNG: Spalte %s fehlt auf der Karte, bleibt leer", name)
			}
		}
		p.sources = append(p.sources, s)
	}
	return p
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

// chunk is a block of grid rows with its own weather sampler. The sampler of a
// block gives the same values as one sampler over all rows, but its plan stays small.
type chunk struct {
	lo, hi  int
	sampler *numeric.CoarseSampler
}

func newChunks(g *Grid, cells []geo.CellKey, rows int) []chunk {
	var out []chunk
	for lo := 0; lo < g.Len(); lo += rows {
		hi := min(lo+rows, g.Len())
		out = append(out, chunk{lo, hi, numeric.NewCoarseSampler(cells, g.X[lo:hi], g.Y[lo:hi], TrainCell)})
	}
	return out
}

// weekInput is what one week adds to the columns: the weather row, the date and the horizon.
type weekInput struct {
	week   calendar.Week
	w      int // index in the week table
	table  *weekTable
	fields *activity.Fields
}

// predict assembles the float32 input of one chunk and returns the calibrated
// probability of each row. Only one chunk of the matrix exists at a time (finding 11).
func (p plan) predict(g *Grid, c chunk, fixed map[string][]float32, in weekInput, threads int) ([]float64, error) {
	n, ncol := c.hi-c.lo, len(p.sources)
	x := make([]float32, n*ncol)
	var act map[string][]float32
	week := float64(in.week.Week)
	season := map[string]float32{
		"iso_week": float32(week),
		"week_sin": float32(math.Sin(2 * math.Pi * week / 52.0)),
		"week_cos": float32(math.Cos(2 * math.Pi * week / 52.0)),
	}
	for j, s := range p.sources {
		var col []float32
		switch s.kind {
		case fromGrid:
			col = fixed[s.name][c.lo:c.hi]
		case fromWeather:
			var err error
			if col, err = c.sampler.Sample(in.table.column(s.name, in.w)); err != nil {
				return nil, err
			}
		case fromActivity:
			if act == nil {
				act = activityColumns(in.fields, g.X[c.lo:c.hi], g.Y[c.lo:c.hi], in.week, p.h)
			}
			if col = act[s.name]; col == nil {
				return nil, fmt.Errorf("render: horizon %d has no activity column %s", p.h, s.name)
			}
		}
		for i := range n {
			v := nan32
			switch s.kind {
			case fromGrid, fromWeather, fromActivity:
				v = col[i]
			case fromSeason:
				v = season[s.name]
			case fromConstant:
				v = s.value
			}
			x[i*ncol+j] = v
		}
	}
	return p.model.Probability(x, n, threads)
}

// activityColumns samples the fields at the Thursday of the week: training reads
// the activity up to the day before a visit, and the mean visit is mid-week.
func activityColumns(f *activity.Fields, xs, ys []float64, w calendar.Week, h int) map[string][]float32 {
	out := map[string][]float32{}
	for _, c := range f.SampleAt(xs, ys, w.Day(4), h) {
		out[c.Name] = c.Values
	}
	return out
}

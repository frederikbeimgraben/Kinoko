package render

import (
	"fmt"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
)

// weekTable holds derived weather columns of the rendered weeks on the 5 km cells.
type weekTable struct {
	cells []geo.CellKey
	weeks []calendar.Week
	vals  map[string][]float32 // [w*len(cells)+c]
}

// column returns the values of name in rendered week w, one per cell.
func (t *weekTable) column(name string, w int) []float32 {
	nc := len(t.cells)
	return t.vals[name][w*nc : (w+1)*nc]
}

// buildWeekTable derives names for the last weeks of cube, with lead weeks for the lags and windows and
// forecast empty weeks at the end. The normals come from the whole cube, as region_map.normalwerte and
// input_layers.wochenwetter. It keeps only the cells that the cube holds.
func buildWeekTable(cube *weather.Cube, cells []geo.CellKey, weeks, forecast int, names []string) (*weekTable, error) {
	if cube == nil || len(cube.Weeks) == 0 {
		return nil, fmt.Errorf("render: no weather")
	}
	observed := cube.Weeks[:cube.Observed()]
	if len(observed) == 0 {
		return nil, fmt.Errorf("render: the weather has no observed week")
	}
	all := slices.Clone(observed)
	for k := 1; k <= forecast; k++ {
		all = append(all, observed[len(observed)-1].AddWeeks(k))
	}
	// The cut uses week IDs as region_map.py; the jump of the ID at New Year
	// only moves the start of the lead weeks.
	limit := all[len(all)-1].ID() - (weeks + LeadWeeks)
	first := slices.IndexFunc(all, func(w calendar.Week) bool { return w.ID() > limit })
	if first >= len(observed) {
		return nil, fmt.Errorf("render: forecast of %d weeks is longer than the lead weeks", forecast)
	}
	normals, err := normalsFor(cube, names)
	if err != nil {
		return nil, err
	}
	trimmed := cube.Restrict(cells, all[first]).WithForecast(forecast)
	if len(trimmed.Cells) == 0 {
		return nil, fmt.Errorf("render: no weather cell lies in the grid")
	}
	derived, err := weather.DeriveWith(trimmed, names, normals)
	if err != nil {
		return nil, err
	}
	keep := min(weeks, len(trimmed.Weeks))
	w0, nc := len(trimmed.Weeks)-keep, len(trimmed.Cells)
	out := &weekTable{cells: trimmed.Cells, weeks: trimmed.Weeks[w0:], vals: map[string][]float32{}}
	for name, v := range derived {
		out.vals[name] = slices.Clone(v[w0*nc:])
	}
	return out, nil
}

// normalsFor computes the normals of the bases of each anomaly in names, or nil without one.
func normalsFor(cube *weather.Cube, names []string) (*weather.Normals, error) {
	var bases []string
	for _, n := range names {
		for _, suffix := range []string{"_anom", "_ratio"} {
			if b, ok := strings.CutSuffix(n, suffix); ok && !slices.Contains(bases, b) {
				bases = append(bases, b)
			}
		}
	}
	if len(bases) == 0 {
		return nil, nil
	}
	return weather.ComputeNormals(cube, bases)
}

// weatherNames returns the weather columns of region_map.py that the features
// read: the raw pr, tas and tasmin, the columns of add_lags and the anomalies.
func weatherNames(features []string) []string {
	candidates := slices.Concat(weather.LagVars, weather.LagNames(), weather.AnomalyNames())
	return slices.DeleteFunc(slices.Clone(candidates), func(n string) bool { return !slices.Contains(features, n) })
}

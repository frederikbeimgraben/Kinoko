package weather

import (
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// Cube holds weekly values as a dense grid: each variable is [w*len(Cells)+c].
// Weeks is a run of calendar weeks without gaps. The weeks after the observed
// ones are forecast weeks and hold NaN. Do not change a Cube after NewCube.
type Cube struct {
	Cells    []geo.CellKey
	Weeks    []calendar.Week
	Vars     map[string][]float32
	observed int
	index    map[geo.CellKey]int
}

// NewCube returns a cube whose weeks are all observed. Each slice of vars must
// hold len(weeks)*len(cells) values.
func NewCube(cells []geo.CellKey, weeks []calendar.Week, vars map[string][]float32) *Cube {
	return newCube(cells, weeks, vars, len(weeks))
}

func newCube(cells []geo.CellKey, weeks []calendar.Week, vars map[string][]float32, observed int) *Cube {
	index := make(map[geo.CellKey]int, len(cells))
	for i, c := range cells {
		index[c] = i
	}
	return &Cube{Cells: cells, Weeks: weeks, Vars: vars, observed: observed, index: index}
}

// Index returns the position of cell k.
func (c *Cube) Index(k geo.CellKey) (int, bool) {
	i, ok := c.index[k]
	return i, ok
}

// Observed returns the number of observed weeks. The forecast weeks follow them.
func (c *Cube) Observed() int { return c.observed }

// LastObserved returns the last observed week, or the zero Week for a cube without one.
func (c *Cube) LastObserved() calendar.Week {
	if c.observed == 0 {
		return calendar.Week{}
	}
	return c.Weeks[c.observed-1]
}

// At returns the value of variable v in week w and cell i, or NaN.
func (c *Cube) At(v string, w, i int) float32 {
	vals, ok := c.Vars[v]
	if !ok {
		return nan32
	}
	return vals[w*len(c.Cells)+i]
}

// WithForecast returns a cube with n more weeks, counted over the calendar
// (a week 53 exists only in some years). The new weeks hold NaN.
func (c *Cube) WithForecast(n int) *Cube {
	if n <= 0 {
		return c
	}
	weeks := append([]calendar.Week{}, c.Weeks...)
	last := c.Weeks[len(c.Weeks)-1]
	for step := 1; step <= n; step++ {
		weeks = append(weeks, last.AddWeeks(step))
	}
	vars := make(map[string][]float32, len(c.Vars))
	for name, vals := range c.Vars {
		out := make([]float32, len(weeks)*len(c.Cells))
		copy(out, vals)
		for i := len(vals); i < len(out); i++ {
			out[i] = nan32
		}
		vars[name] = out
	}
	return newCube(c.Cells, weeks, vars, c.observed)
}

// Restrict returns a cube with the cells of cells that c holds, in that order,
// and the weeks from fromWeek on.
func (c *Cube) Restrict(cells []geo.CellKey, fromWeek calendar.Week) *Cube {
	keep := make([]geo.CellKey, 0, len(cells))
	pos := make([]int, 0, len(cells))
	seen := map[geo.CellKey]bool{}
	for _, k := range cells {
		if i, ok := c.index[k]; ok && !seen[k] {
			keep, pos, seen[k] = append(keep, k), append(pos, i), true
		}
	}
	w0 := 0
	for w0 < len(c.Weeks) && c.Weeks[w0].Before(fromWeek) {
		w0++
	}
	weeks := c.Weeks[w0:]
	vars := make(map[string][]float32, len(c.Vars))
	for name, vals := range c.Vars {
		out := make([]float32, len(weeks)*len(keep))
		for w := range weeks {
			src := vals[(w0+w)*len(c.Cells):]
			dst := out[w*len(keep):]
			for j, i := range pos {
				dst[j] = src[i]
			}
		}
		vars[name] = out
	}
	return newCube(keep, weeks, vars, max(c.observed-w0, 0))
}

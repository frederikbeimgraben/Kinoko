package activity

import (
	"math"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/horizons"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/numeric"
)

// Column is one sampled feature column.
type Column struct {
	Name   string
	Values []float32
}

// Sample is ActivityFields.sample: the rate of each window at the points, for the
// dates moved back by h weeks. A zero date (NaT) or a day before the first day
// gives NaN. A day past the last day reads the last day. Names come from horizons.ActivityNames(h).
func (f *Fields) Sample(xs, ys []float64, dates []time.Time, h int) []Column {
	return f.sample(xs, ys, func(i int) time.Time { return dates[i] }, h)
}

// SampleAt is Sample with one date for each point, for example the Thursday of a map week.
func (f *Fields) SampleAt(xs, ys []float64, date time.Time, h int) []Column {
	return f.sample(xs, ys, func(int) time.Time { return date }, h)
}

func (f *Fields) sample(xs, ys []float64, dateOf func(int) time.Time, h int) []Column {
	names := horizons.ActivityNames(h)
	out := make([]Column, len(horizons.Windows))
	for wi, w := range horizons.Windows {
		vals := make([]float32, len(xs))
		for i := range xs {
			vals[i] = f.at(f.rate[w], xs[i], ys[i], dateOf(i), h)
		}
		out[wi] = Column{Name: names[wi], Values: vals}
	}
	return out
}

// at reads one rate field by trilinear interpolation with the edges held. A block
// covers [i, i+1) in block units, so the centre of block i maps to index i.
func (f *Fields) at(rate []float32, x, y float64, date time.Time, h int) float32 {
	if date.IsZero() {
		return float32(math.NaN())
	}
	d := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	dayIdx := float64(int(d.Sub(f.day0)/day)) - float64(7*h)
	if math.IsNaN(x) || math.IsNaN(y) || dayIdx < 0 {
		return float32(math.NaN())
	}
	dayIdx = min(dayIdx, float64(f.nDays-1))
	fx := x/f.size - float64(f.x0) - 0.5
	fy := y/f.size - float64(f.y0) - 0.5
	return numeric.MapLinearNearest3(rate, [3]int{f.nx, f.ny, f.nDays}, [3]float64{fx, fy, dayIdx})
}

// Day0 gives the first day of the fields.
func (f *Fields) Day0() time.Time { return f.day0 }

// Days gives the number of days of the fields.
func (f *Fields) Days() int { return f.nDays }

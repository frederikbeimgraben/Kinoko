// Package activity holds the activity fields: the share of observer-days
// that found a target taxon on 25 km blocks, in windows that end the day before a date.
package activity

import (
	"errors"
	"math"
	"slices"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/horizons"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/numeric"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
)

// BlockM is BLOCK_M, the edge of a block in metres.
const BlockM = 25_000

// ErrNoRecords tells that no record has an observer.
var ErrNoRecords = errors.New("activity: no record with an observer")

const day = 24 * time.Hour

// Fields holds the rate of each window on a dense (block x, block y, day) grid.
// Build it from occ.TrainingSet records for training and for the map alike (finding 5).
type Fields struct {
	size   float64
	x0, y0 int
	nx, ny int
	nDays  int
	day0   time.Time
	rate   map[int][]float32 // window -> C-order (nx, ny, nDays)
}

// blockDay is one observer-day key and then one block-day key.
type blockDay struct {
	bx, by int
	day    time.Time
}

// New builds the fields from the records with an observer, as ActivityFields.__init__.
func New(records []occ.Record, taxa []string, blockM float64) (*Fields, error) {
	type visitKey struct {
		blockDay
		who string
	}
	visits := map[visitKey]bool{}
	for _, r := range records {
		if !r.HasObserver() {
			continue
		}
		k := visitKey{blockDay{int(geo.FloorDiv(r.X, blockM)), int(geo.FloorDiv(r.Y, blockM)), r.Date}, r.Observer}
		visits[k] = visits[k] || slices.Contains(taxa, r.Species)
	}
	if len(visits) == 0 {
		return nil, ErrNoRecords
	}
	type tally struct{ visits, targets float32 }
	daily := map[blockDay]tally{}
	for k, target := range visits {
		t := daily[k.blockDay]
		t.visits++
		if target {
			t.targets++
		}
		daily[k.blockDay] = t
	}
	f := &Fields{size: blockM, x0: math.MaxInt, y0: math.MaxInt}
	x1, y1 := math.MinInt, math.MinInt
	var last time.Time
	for k := range daily {
		f.x0, f.y0, x1, y1 = min(f.x0, k.bx), min(f.y0, k.by), max(x1, k.bx), max(y1, k.by)
		if f.day0.IsZero() || k.day.Before(f.day0) {
			f.day0 = k.day
		}
		if k.day.After(last) {
			last = k.day
		}
	}
	f.nx, f.ny = x1-f.x0+1, y1-f.y0+1
	f.nDays = int(last.Sub(f.day0)/day) + 1
	counts := make([]float32, f.nx*f.ny*f.nDays)
	hits := make([]float32, len(counts))
	for k, t := range daily {
		i := f.index(k.bx-f.x0, k.by-f.y0, int(k.day.Sub(f.day0)/day))
		counts[i], hits[i] = t.visits, t.targets
	}
	counts = numeric.Box3x3(counts, f.nx, f.ny, f.nDays)
	hits = numeric.Box3x3(hits, f.nx, f.ny, f.nDays)
	c, h := f.prefix(counts), f.prefix(hits)
	f.rate = map[int][]float32{}
	for _, w := range horizons.Windows {
		f.rate[w] = f.windowRate(c, h, w)
	}
	return f, nil
}

func (f *Fields) index(ix, iy, it int) int { return (ix*f.ny+iy)*f.nDays + it }

// prefix gives the float32 cumulative sum along the days with a leading zero,
// shape (nx, ny, nDays+1), as np.concatenate([pad, np.cumsum(a, axis=2)]).
func (f *Fields) prefix(a []float32) []float32 {
	n := f.nDays + 1
	out := make([]float32, f.nx*f.ny*n)
	for cell := range f.nx * f.ny {
		var acc float32
		for t := range f.nDays {
			acc += a[cell*f.nDays+t]
			out[cell*n+t+1] = acc
		}
	}
	return out
}

// windowRate is hits over max(counts, 1) for the window of w days before each day,
// in float32. The day itself stays out of its window.
func (f *Fields) windowRate(c, h []float32, w int) []float32 {
	n := f.nDays + 1
	out := make([]float32, f.nx*f.ny*f.nDays)
	for cell := range f.nx * f.ny {
		for d := range f.nDays {
			lo := max(d-w, 0)
			counts := c[cell*n+d] - c[cell*n+lo]
			hits := h[cell*n+d] - h[cell*n+lo]
			out[cell*f.nDays+d] = hits / max(counts, 1)
		}
	}
	return out
}

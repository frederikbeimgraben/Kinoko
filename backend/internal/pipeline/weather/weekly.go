package weather

import (
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
)

// weekAcc collects the days of one ISO week for each cell.
type weekAcc struct {
	sum  []float64
	n    []int32
	ext  []float32 // the minimum, the maximum or the last value
	seen []bool
}

func newWeekAcc(nCells int) *weekAcc {
	return &weekAcc{sum: make([]float64, nCells), n: make([]int32, nCells),
		ext: make([]float32, nCells), seen: make([]bool, nCells)}
}

func (a *weekAcc) add(how How, row []float32) {
	for c, v := range row {
		if isNaN32(v) {
			continue
		}
		a.sum[c] += float64(v)
		a.n[c]++
		switch {
		case !a.seen[c], how == Last, how == Min && v < a.ext[c], how == Max && v > a.ext[c]:
			a.ext[c] = v
		}
		a.seen[c] = true
	}
}

// values reduces the week. It fixes two findings of extract_grids.py, which
// reduces each year file to weeks first and then combines the parts again:
//   - bug 8: the mean of a week that spans two year files is a mean over its
//     days, not the mean of two part means;
//   - bug 9: the sum of a week without a value is NaN, not 0
//     (pandas sum with min_count=0).
func (a *weekAcc) values(how How) []float32 {
	out := make([]float32, len(a.n))
	for c, n := range a.n {
		switch {
		case n == 0:
			out[c] = nan32
		case how == Sum:
			out[c] = float32(a.sum[c])
		case how == Mean:
			out[c] = float32(a.sum[c] / float64(n))
		default:
			out[c] = a.ext[c]
		}
	}
	return out
}

// weekly reduces daily values to ISO weeks as a stream over the year files.
// A week stays open while a later file can add days to it.
type weekly struct {
	how    How
	nCells int
	open   map[calendar.Week]*weekAcc
	done   map[calendar.Week][]float32
}

func newWeekly(how How, nCells int) *weekly {
	return &weekly{how: how, nCells: nCells, open: map[calendar.Week]*weekAcc{},
		done: map[calendar.Week][]float32{}}
}

// addFile adds the days of one year file, [day][cell]. Then it closes each
// week but the week of the last day of the file.
func (w *weekly) addFile(daily []float32, days []time.Time) {
	for d, day := range days {
		wk := calendar.WeekOf(day)
		acc, ok := w.open[wk]
		if !ok {
			acc = newWeekAcc(w.nCells)
			w.open[wk] = acc
		}
		acc.add(w.how, daily[d*w.nCells:(d+1)*w.nCells])
	}
	var keep calendar.Week
	if len(days) > 0 {
		keep = calendar.WeekOf(days[len(days)-1])
	}
	for wk, acc := range w.open {
		if wk != keep {
			w.done[wk] = acc.values(w.how)
			delete(w.open, wk)
		}
	}
}

// result closes the open weeks and returns the value of each week, [cell].
func (w *weekly) result() map[calendar.Week][]float32 {
	for wk, acc := range w.open {
		w.done[wk] = acc.values(w.how)
	}
	w.open = map[calendar.Week]*weekAcc{}
	return w.done
}

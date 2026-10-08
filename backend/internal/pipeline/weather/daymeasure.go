package weather

import "math"

// DayMeasure maps the daily cell means of one year file, [day][cell] with
// nCells cells, to a day measure of the same shape (day_measures.py).
type DayMeasure func(daily []float32, nCells int) []float32

// ThresholdDays marks each day above (or below) th with 1 and each other day
// with 0, so that a week can sum them. A day without a value stays NaN.
func ThresholdDays(th float32, above bool) DayMeasure {
	return func(daily []float32, _ int) []float32 {
		out := make([]float32, len(daily))
		for i, v := range daily {
			switch {
			case isNaN32(v):
				out[i] = nan32
			case (above && v > th) || (!above && v < th):
				out[i] = 1
			}
		}
		return out
	}
}

// DaysSince counts the days since the last day above th, per cell, up to limit.
// The returned measure keeps the counter between calls, one call per year
// file, so it is not pure. The counter starts at limit.
func DaysSince(th, limit float32) DayMeasure {
	var counter []float32
	return func(daily []float32, nCells int) []float32 {
		if len(counter) != nCells {
			counter = make([]float32, nCells)
			for c := range counter {
				counter[c] = limit
			}
		}
		out := make([]float32, len(daily))
		for d := 0; d*nCells < len(daily); d++ {
			row := daily[d*nCells : (d+1)*nCells]
			for c, v := range row {
				// A day without a value counts as a dry day; else the cell stays NaN for ever.
				if v > th {
					counter[c] = 0
				} else {
					counter[c] = min(counter[c]+1, limit)
				}
				if isNaN32(v) {
					out[d*nCells+c] = nan32
				} else {
					out[d*nCells+c] = counter[c]
				}
			}
		}
		return out
	}
}

var nan32 = float32(math.NaN())

func isNaN32(v float32) bool { return v != v }

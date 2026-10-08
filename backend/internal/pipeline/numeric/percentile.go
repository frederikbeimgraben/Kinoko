package numeric

import (
	"math"
	"slices"
)

// NanPercentile is np.nanpercentile(v, [q]) with the linear method for a
// float32 array and a list of q. The list form makes numpy return float64.
func NanPercentile(v []float32, q float64) float64 {
	sorted := slices.Sorted(func(yield func(float32) bool) {
		for _, x := range v {
			if !math.IsNaN(float64(x)) && !yield(x) {
				return
			}
		}
	})
	return lerpQuantile(len(sorted), q, func(i int) (float64, float64, float64) {
		a, b := sorted[i], sorted[min(i+1, len(sorted)-1)]
		return float64(a), float64(b), float64(b - a)
	})
}

// NanPercentile64 is np.nanpercentile(v, q) with the linear method for a
// float64 array.
func NanPercentile64(v []float64, q float64) float64 {
	sorted := slices.Sorted(func(yield func(float64) bool) {
		for _, x := range v {
			if !math.IsNaN(x) && !yield(x) {
				return
			}
		}
	})
	return lerpQuantile(len(sorted), q, func(i int) (float64, float64, float64) {
		a, b := sorted[i], sorted[min(i+1, len(sorted)-1)]
		return a, b, b - a
	})
}

// lerpQuantile is _quantile of numpy for the method "linear". The pair
// function gives the two order statistics and their difference in the
// storage type, because numpy subtracts them before it promotes to float64.
func lerpQuantile(n int, q float64, pair func(int) (a, b, diff float64)) float64 {
	if n == 0 {
		return math.NaN()
	}
	virtual := float64(n-1) * (q / 100)
	if virtual >= float64(n-1) {
		a, _, _ := pair(n - 1)
		return a
	}
	prev := math.Floor(virtual)
	i := int(prev)
	if virtual < 0 {
		i, prev = 0, 0
	}
	gamma := virtual - prev
	a, b, diff := pair(i)
	if gamma >= 0.5 {
		return b - diff*(1-gamma)
	}
	return a + diff*gamma
}

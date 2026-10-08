package numeric

import (
	"cmp"
	"math"
	"slices"
	"sort"
)

// Isotonic is a fitted sklearn IsotonicRegression(out_of_bounds="clip"),
// increasing. X and Y are X_thresholds_ and y_thresholds_.
type Isotonic struct {
	X, Y       []float64
	XMin, XMax float64
}

// uniqueEps is np.finfo(float64).resolution, the step of _make_unique.
const uniqueEps = 1e-15

// FitIsotonic fits an increasing isotonic curve with unit weights, as
// IsotonicRegression._build_y in sklearn 1.8 with scipy 1.17.
func FitIsotonic(x, y []float64) Isotonic {
	order := make([]int, len(x))
	for i := range order {
		order[i] = i
	}
	slices.SortStableFunc(order, func(a, b int) int {
		return cmp.Or(cmp.Compare(x[a], x[b]), cmp.Compare(y[a], y[b]))
	})
	ux, uy, uw := makeUnique(order, x, y)
	fit := pava(uy, uw)
	keep := func(i int) bool {
		return i == 0 || i == len(fit)-1 || fit[i] != fit[i-1] || fit[i] != fit[i+1]
	}
	var iso Isotonic
	for i := range fit {
		if keep(i) {
			iso.X = append(iso.X, ux[i])
			iso.Y = append(iso.Y, fit[i])
		}
	}
	iso.XMin, iso.XMax = slices.Min(ux), slices.Max(ux)
	return iso
}

// makeUnique is sklearn _make_unique: x values closer than uniqueEps to the
// first value of a run join it, with the weighted mean of y.
func makeUnique(order []int, x, y []float64) (ux, uy, uw []float64) {
	cur := x[order[0]]
	sumY, weight := 0.0, 0.0
	for _, j := range order {
		if x[j]-cur >= uniqueEps {
			ux, uy, uw = append(ux, cur), append(uy, sumY/weight), append(uw, weight)
			cur, weight, sumY = x[j], 1, y[j]*1
			continue
		}
		weight += 1
		sumY += y[j] * 1
	}
	return append(ux, cur), append(uy, sumY/weight), append(uw, weight)
}

// pava is scipy.optimize.isotonic_regression (Busing 2022, algorithm 1),
// increasing. It returns the fitted values and keeps x and w unchanged.
func pava(x0, w0 []float64) []float64 {
	x := slices.Clone(x0)
	w := slices.Clone(w0)
	n := len(x)
	r := make([]int, n+1)
	r[0], r[1] = 0, 1
	b := 0
	xbPrev, wbPrev := x[0], w[0]
	for i := 1; i < n; i++ {
		b++
		xb, wb := x[i], w[i]
		if xbPrev >= xb {
			b--
			sb := wbPrev*xbPrev + wb*xb
			wb += wbPrev
			xb = sb / wb
			for i < n-1 && xb >= x[i+1] {
				i++
				sb += w[i] * x[i]
				wb += w[i]
				xb = sb / wb
			}
			for b > 0 && x[b-1] >= xb {
				b--
				sb += w[b] * x[b]
				wb += w[b]
				xb = sb / wb
			}
		}
		x[b], xbPrev = xb, xb
		w[b], wbPrev = wb, wb
		r[b+1] = i + 1
	}
	out := make([]float64, n)
	f := n - 1
	for k := b; k >= 0; k-- {
		t := r[k]
		for i := f; i >= t; i-- {
			out[i] = x[k]
		}
		f = t - 1
	}
	return out
}

// Predict is IsotonicRegression.predict for one value: a clip to the fitted
// range, then the scipy interp1d linear formula.
func (iso Isotonic) Predict(t float64) float64 {
	if len(iso.Y) == 1 {
		return iso.Y[0]
	}
	if math.IsNaN(t) {
		return math.NaN()
	}
	t = min(max(t, iso.XMin), iso.XMax)
	n := len(iso.X)
	hi := min(max(sort.SearchFloat64s(iso.X, t), 1), n-1)
	lo := hi - 1
	slope := (iso.Y[hi] - iso.Y[lo]) / (iso.X[hi] - iso.X[lo])
	return slope*(t-iso.X[lo]) + iso.Y[lo]
}

// PredictAll applies Predict to each value.
func (iso Isotonic) PredictAll(t []float64) []float64 {
	out := make([]float64, len(t))
	for i, v := range t {
		out[i] = iso.Predict(v)
	}
	return out
}

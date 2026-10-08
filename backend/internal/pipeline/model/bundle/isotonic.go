package bundle

import (
	"fmt"
	"math"
	"slices"
	"sort"
)

// Isotonic is a fitted sklearn IsotonicRegression(out_of_bounds="clip"), as its thresholds.
// X holds X_thresholds_ in ascending order, Y holds y_thresholds_.
type Isotonic struct {
	X           []float64 `json:"x"`
	Y           []float64 `json:"y"`
	XMin        float64   `json:"xMin"`
	XMax        float64   `json:"xMax"`
	Increasing  bool      `json:"increasing"`
	OutOfBounds string    `json:"outOfBounds"`
}

// Validate makes sure that Predict can use the curve.
func (c Isotonic) Validate() error {
	switch {
	case len(c.X) == 0 || len(c.X) != len(c.Y):
		return fmt.Errorf("isotonic: %d thresholds x and %d thresholds y", len(c.X), len(c.Y))
	case !c.Increasing:
		return fmt.Errorf("isotonic: only an increasing curve is supported")
	case c.OutOfBounds != "clip":
		return fmt.Errorf("isotonic: out_of_bounds %q is not supported", c.OutOfBounds)
	case !slices.IsSorted(c.X):
		return fmt.Errorf("isotonic: thresholds x are not sorted")
	case slices.ContainsFunc(c.X, isNaN) || slices.ContainsFunc(c.Y, isNaN):
		return fmt.Errorf("isotonic: thresholds contain NaN")
	}
	return nil
}

func isNaN(v float64) bool { return math.IsNaN(v) }

// Predict returns the calibrated value of x as sklearn: clip to [XMin, XMax], then np.interp.
// sklearn delegates to np.interp through scipy interp1d for float64 data, so this ports np.interp.
func (c Isotonic) Predict(x float64) float64 {
	if math.IsNaN(x) {
		return math.NaN()
	}
	if len(c.Y) == 1 {
		return c.Y[0]
	}
	return interp(min(max(x, c.XMin), c.XMax), c.X, c.Y)
}

// PredictAll applies Predict to each value.
func (c Isotonic) PredictAll(xs []float64) []float64 {
	out := make([]float64, len(xs))
	for i, x := range xs {
		out[i] = c.Predict(x)
	}
	return out
}

// interp ports numpy's arr_interp for one finite value, with fp[0] and fp[-1] outside the range.
func interp(x float64, xp, fp []float64) float64 {
	n := len(xp)
	switch {
	case x < xp[0]:
		return fp[0]
	case x >= xp[n-1]:
		return fp[n-1]
	}
	j := sort.Search(n, func(i int) bool { return xp[i] > x }) - 1
	if xp[j] == x {
		return fp[j]
	}
	slope := (fp[j+1] - fp[j]) / (xp[j+1] - xp[j])
	// The float64 conversion stops a fused multiply-add on arm64, which numpy on x86-64 does not use.
	out := float64(slope*(x-xp[j])) + fp[j]
	if math.IsNaN(out) {
		out = float64(slope*(x-xp[j+1])) + fp[j+1]
		if math.IsNaN(out) && fp[j] == fp[j+1] {
			out = fp[j]
		}
	}
	return out
}

package render

import (
	"math"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/hist"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/numeric"
)

// Smooth is the field filter of the species map: a normalised Gaussian with scipy's mode "reflect". The field
// is float64 and the mask float32, so the threshold 0.08 compares in float32. Without spill, a NaN cell stays
// NaN. With spill, masked cells next to valid ones get a value (finding 10).
func Smooth(field []float64, ny, nx int, sigma float64, spill bool) []float64 {
	if sigma <= 0 {
		return field
	}
	filled := make([]float64, len(field))
	mask := make([]float32, len(field))
	for i, v := range field {
		if !math.IsNaN(v) && !math.IsInf(v, 0) {
			filled[i], mask[i] = v, 1
		}
	}
	blur := numeric.Gaussian2D64(filled, ny, nx, sigma, numeric.Reflect)
	norm := numeric.Gaussian2D32(mask, ny, nx, sigma, numeric.Reflect)
	out := make([]float64, len(field))
	for i := range out {
		switch {
		case !spill && mask[i] == 0:
			out[i] = math.NaN()
		case norm[i] > smoothNorm:
			out[i] = blur[i] / float64(max(norm[i], float32(1e-6)))
		default:
			out[i] = math.NaN()
		}
	}
	return out
}

// nanMean is np.nanmean: the pairwise sum with NaN as 0, divided by the count of the other values.
func nanMean(field []float64) float64 {
	filled := make([]float64, len(field))
	n := 0
	for i, v := range field {
		if !math.IsNaN(v) {
			filled[i] = v
			n++
		}
	}
	if n == 0 {
		return math.NaN()
	}
	return numeric.Sum(filled) / float64(n)
}

// nanMax is np.nanmax, NaN when no value is set.
func nanMax(field []float64) float64 {
	out := math.NaN()
	for _, v := range field {
		if !math.IsNaN(v) && (math.IsNaN(out) || v > out) {
			out = v
		}
	}
	return out
}

// weekEntry is one item of "weeks" in a species manifest, in the key order of schreibe_woche.
func weekEntry(year, week int, ahead bool, field []float64, top float64, tilesPath string) (*pyjson.Obj, error) {
	e := pyjson.O("year", year, "week", week, "forecast", ahead,
		"mean", pyjson.Round(nanMean(field), 4), "max", pyjson.Round(nanMax(field), 4))
	h, err := hist.Compute(field, 0.0, top)
	if err != nil {
		return nil, err
	}
	if h != nil {
		e.Set("histogram", h)
	}
	return e.Set("tiles", tilesPath), nil
}

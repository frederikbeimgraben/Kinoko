// Package hist counts the values of a field into the classes that the Faktor
// screen shows, as manifest.histogram.
package hist

import (
	"fmt"
	"math"
	"sort"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

// Classes is the number of classes over the scale.
const Classes = 40

// Histogram holds Classes+1 class edges and the share of the valid values in
// each class, both rounded to six decimals.
type Histogram struct{ Classes, Shares []float64 }

// PyJSON returns {"classes": [...], "shares": [...]} in this order.
func (h *Histogram) PyJSON() any {
	return pyjson.O("classes", h.Classes, "shares", h.Shares)
}

// Compute counts the finite values into Classes equal classes over low..high.
// A value outside the scale goes into the first or the last class. It returns
// nil when no value is finite, and an error unless high > low.
func Compute(vals []float64, low, high float64) (*Histogram, error) {
	if !(high > low) {
		return nil, fmt.Errorf("hist: scale without width: %v to %v", low, high)
	}
	valid := fn.Filter(vals, func(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) })
	edges := linspace(low, high, Classes+1)
	if len(valid) == 0 {
		return nil, nil
	}
	counts := make([]int, Classes)
	for _, v := range valid {
		counts[bin(edges, min(max(v, low), high))]++
	}
	n := float64(len(valid))
	return &Histogram{
		Classes: fn.Map(edges, func(e float64) float64 { return pyjson.Round(e, 6) }),
		Shares:  fn.Map(counts, func(c int) float64 { return pyjson.Round(float64(c)/n, 6) }),
	}, nil
}

// ComputeFloat32 is Compute for a float32 field. Each value is cast to float64 first.
func ComputeFloat32(vals []float32, low, high float64) (*Histogram, error) {
	return Compute(fn.Map(vals, func(v float32) float64 { return float64(v) }), low, high)
}

// linspace is numpy.linspace(start, stop, num) with endpoint: i*step + start,
// and stop exactly at the end.
func linspace(start, stop float64, num int) []float64 {
	step := (stop - start) / float64(num-1)
	out := make([]float64, num)
	for i := range out {
		// The conversion rounds the product and so prevents a fused multiply-add.
		out[i] = float64(float64(i)*step) + start
	}
	out[num-1] = stop
	return out
}

// bin returns the class of v as np.histogram with explicit edges: the last
// class i with edges[i] <= v, where the last class also holds edges[last].
func bin(edges []float64, v float64) int {
	inner := edges[1 : len(edges)-1]
	return sort.Search(len(inner), func(i int) bool { return inner[i] > v })
}

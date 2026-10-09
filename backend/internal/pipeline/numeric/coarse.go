package numeric

import (
	"fmt"
	"math"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

const (
	// SigmaCells is the Gaussian width of CoarseSampler, in coarse cells.
	SigmaCells = 0.5
	// MinWeight is the known-cell weight under which a point stays missing.
	MinWeight = 0.3
)

// CoarseSampler reads a coarse cell field at fine points after a Gaussian
// filter that counts only known cells. It ports coarse_inputs.CoarseSampler.
type CoarseSampler struct {
	ny, nx    int
	flat      []int // flat array index of each coarse cell
	corners   [4][]int32
	weights   [4][]float32
	sigma     float64
	minWeight float32
	full      []float32 // weight of a column with no gap, shared
}

// NewCoarseSampler plans the reads of the points xs, ys (EPSG:3035 metres)
// from the cells, with cell size cellM, sigma SigmaCells and MinWeight.
func NewCoarseSampler(cells []geo.CellKey, xs, ys []float64, cellM float64) *CoarseSampler {
	x0 := slices.MinFunc(cells, func(a, b geo.CellKey) int { return int(a.X) - int(b.X) }).X
	y0 := slices.MinFunc(cells, func(a, b geo.CellKey) int { return int(a.Y) - int(b.Y) }).Y
	x1 := slices.MaxFunc(cells, func(a, b geo.CellKey) int { return int(a.X) - int(b.X) }).X
	y1 := slices.MaxFunc(cells, func(a, b geo.CellKey) int { return int(a.Y) - int(b.Y) }).Y
	s := &CoarseSampler{
		ny: int(y1-y0) + 1, nx: int(x1-x0) + 1,
		sigma: SigmaCells, minWeight: float32(MinWeight),
	}
	s.flat = make([]int, len(cells))
	for i, c := range cells {
		s.flat[i] = int(c.Y-y0)*s.nx + int(c.X-x0)
	}
	n := len(xs)
	for k := range 4 {
		s.corners[k] = make([]int32, n)
		s.weights[k] = make([]float32, n)
	}
	fny, fnx := float64(s.ny), float64(s.nx)
	for i := range n {
		row := ys[i]/cellM - float64(y0) - 0.5
		col := xs[i]/cellM - float64(x0) - 0.5
		inside := row >= -0.5 && row <= fny-0.5 && col >= -0.5 && col <= fnx-0.5
		r := min(max(row, 0), fny-1)
		c := min(max(col, 0), fnx-1)
		r0, c0 := int32(math.Floor(r)), int32(math.Floor(c))
		r1, c1 := min(r0+1, int32(s.ny-1)), min(c0+1, int32(s.nx-1))
		dr, dc := float32(r-float64(r0)), float32(c-float64(c0))
		nx32 := int32(s.nx)
		s.corners[0][i], s.corners[1][i] = r0*nx32+c0, r0*nx32+c1
		s.corners[2][i], s.corners[3][i] = r1*nx32+c0, r1*nx32+c1
		share := [4]float32{(1 - dr) * (1 - dc), (1 - dr) * dc, dr * (1 - dc), dr * dc}
		in := float32(0)
		if inside {
			in = 1
		}
		for k := range 4 {
			s.weights[k][i] = share[k] * in
		}
	}
	ones := make([]float32, len(cells))
	for i := range ones {
		ones[i] = 1
	}
	s.full = s.layer(ones)
	return s
}

// read is the bilinear read of a filtered field. It sums the four terms
// from 0 in float32, in a fixed order.
func (s *CoarseSampler) read(field []float32) []float32 {
	out := make([]float32, len(s.weights[0]))
	for i := range out {
		acc := float32(0)
		for k := range 4 {
			acc += float32(field[s.corners[k][i]] * s.weights[k][i])
		}
		out[i] = acc
	}
	return out
}

// spread puts one value per cell into the coarse array; a later cell wins.
func (s *CoarseSampler) spread(vals []float32) []float32 {
	field := make([]float32, s.ny*s.nx)
	for i, f := range s.flat {
		field[f] = vals[i]
	}
	return field
}

// layer filters a spread column and reads it at the points.
func (s *CoarseSampler) layer(vals []float32) []float32 {
	return s.read(Gaussian2D(s.spread(vals), s.ny, s.nx, s.sigma, Constant))
}

// Sample returns the value at each point for one value per cell, in the
// order of the cells. A NaN cell adds no weight; a weak point gives NaN.
func (s *CoarseSampler) Sample(vals []float32) ([]float32, error) {
	if len(vals) != len(s.flat) {
		return nil, fmt.Errorf("numeric: %d values for %d cells", len(vals), len(s.flat))
	}
	filled := make([]float32, len(vals))
	known := make([]float32, len(vals))
	gap := false
	for i, v := range vals {
		if !math.IsNaN(float64(v)) && !math.IsInf(float64(v), 0) {
			filled[i], known[i] = v, 1
		} else {
			gap = true
		}
	}
	total := s.layer(filled)
	weight := s.full
	if gap {
		weight = s.layer(known)
	}
	out := make([]float32, len(total))
	nan := float32(math.NaN())
	for i := range out {
		if weight[i] > s.minWeight {
			out[i] = total[i] / max(weight[i], float32(1e-6))
		} else {
			out[i] = nan
		}
	}
	return out, nil
}

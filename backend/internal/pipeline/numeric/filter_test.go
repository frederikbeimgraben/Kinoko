package numeric

import "testing"

var modes = map[string]Mode{"constant": Constant, "reflect": Reflect, "nearest": Nearest}

// Golden values: scipy.ndimage.gaussian_filter (testdata/gen_golden.py).
func TestGaussian2D(t *testing.T) {
	var cases []struct {
		Dtype         string
		Ny, Nx        int
		Sigma         float64
		Mode          string
		Input, Output floats
	}
	load(t, "gaussian.json", &cases)
	for _, c := range cases {
		label := c.Dtype + "/" + c.Mode
		if c.Dtype == "float32" {
			checkAll(t, label, Gaussian2D32(c.Input.f32(), c.Ny, c.Nx, c.Sigma, modes[c.Mode]), c.Output, 1e-6, 1e-12)
		} else {
			checkAll(t, label, Gaussian2D64(c.Input, c.Ny, c.Nx, c.Sigma, modes[c.Mode]), c.Output, 1e-12, 1e-15)
		}
	}
}

// Golden values: scipy.ndimage.uniform_filter, and uniform_filter*size² as in
// tree_scales.py (testdata/gen_golden.py).
func TestUniform2D(t *testing.T) {
	var cases []struct {
		Ny, Nx, Size       int
		Mode               string
		Input, Output, Sum floats
	}
	load(t, "uniform.json", &cases)
	for _, c := range cases {
		in := c.Input.f32()
		checkAll(t, c.Mode, Uniform2D(in, c.Ny, c.Nx, c.Size, modes[c.Mode]), c.Output, 0, 0)
		checkAll(t, "sum", UniformSum2D(in, c.Ny, c.Nx, c.Size), c.Sum, 0, 0)
	}
}

// Golden values: scipy.ndimage.convolve with a 3x3x1 kernel and
// map_coordinates(order=1, mode="nearest") (testdata/gen_golden.py).
func TestVolume(t *testing.T) {
	var g struct {
		Vol, Box, Rate, Values floats
		Shape                  [3]int
		RateShape              [3]int `json:"rate_shape"`
		Coords                 [][3]float64
	}
	load(t, "volume.json", &g)
	checkAll(t, "box", Box3x3(g.Vol.f32(), g.Shape[0], g.Shape[1], g.Shape[2]), g.Box, 0, 0)
	rate := g.Rate.f32()
	got := make([]float32, len(g.Coords))
	for i, c := range g.Coords {
		got[i] = MapLinearNearest3(rate, g.RateShape, c)
	}
	checkAll(t, "map", got, g.Values, 0, 0)
}

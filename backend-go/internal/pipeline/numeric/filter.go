package numeric

import "math"

// Mode is the border mode of a scipy.ndimage filter.
type Mode int

const (
	// Constant pads with zero (scipy mode "constant", cval 0).
	Constant Mode = iota
	// Reflect mirrors at the edge, the edge value included (scipy "reflect").
	Reflect
	// Nearest repeats the edge value (scipy "nearest").
	Nearest
)

// Truncate is the scipy default kernel truncation, in standard deviations.
const Truncate = 4.0

// dblEpsilon is DBL_EPSILON, the symmetry tolerance of NI_Correlate1D.
const dblEpsilon = 2.220446049250313e-16

// extend returns the source index of the line position i, or -1 for the
// constant pad. It gives the same values as NI_ExtendLine.
func extend(i, n int, mode Mode) int {
	if i >= 0 && i < n {
		return i
	}
	switch mode {
	case Nearest:
		return min(max(i, 0), n-1)
	case Reflect:
		if n == 1 {
			return 0
		}
		m := i % (2 * n)
		if m < 0 {
			m += 2 * n
		}
		if m >= n {
			m = 2*n - 1 - m
		}
		return m
	default:
		return -1
	}
}

// fillLine copies a line into a float64 buffer with before and after pad cells.
func fillLine(buf []float64, get func(int) float64, n, before int, mode Mode) {
	for k := range buf {
		src := extend(k-before, n, mode)
		if src < 0 {
			buf[k] = 0
		} else {
			buf[k] = get(src)
		}
	}
}

// GaussianKernel returns the weights of scipy _gaussian_kernel1d for order 0
// and the radius int(Truncate*sigma + 0.5).
func GaussianKernel(sigma float64) []float64 {
	radius := int(Truncate*sigma + 0.5)
	factor := -0.5 / (sigma * sigma)
	phi := make([]float64, 2*radius+1)
	for k := range phi {
		x := float64(k - radius)
		phi[k] = math.Exp(factor * (x * x))
	}
	total := Sum(phi)
	for k := range phi {
		phi[k] /= total
	}
	return phi
}

// symmetric tells if NI_Correlate1D takes its symmetric path for w.
func symmetric(w []float64) bool {
	if len(w)%2 == 0 {
		return false
	}
	c := len(w) / 2
	for i := 1; i <= c; i++ {
		if math.Abs(w[c+i]-w[c-i]) > dblEpsilon {
			return false
		}
	}
	return true
}

// correlateLine is the inner loop of NI_Correlate1D with origin 0.
func correlateLine(out, buf, w []float64) {
	size1 := len(w) / 2
	size2 := len(w) - size1 - 1
	fw := func(j int) float64 { return w[j+size1] }
	if symmetric(w) {
		for l := range out {
			c := l + size1
			acc := buf[c] * fw(0)
			for j := -size1; j < 0; j++ {
				acc += (buf[c+j] + buf[c-j]) * fw(j)
			}
			out[l] = acc
		}
		return
	}
	for l := range out {
		c := l + size1
		acc := buf[c+size2] * fw(size2)
		for j := -size1; j < size2; j++ {
			acc += buf[c+j] * fw(j)
		}
		out[l] = acc
	}
}

// uniformLine is the inner loop of NI_UniformFilter1D with origin 0: a
// running sum in float64 that adds the new cell and drops the old one.
// Each output divides the sum by the size, as scipy 1.17 does.
func uniformLine(out, buf []float64, size int) {
	div := float64(size)
	acc := 0.0
	for k := range size {
		acc += buf[k]
	}
	out[0] = acc / div
	for l := 1; l < len(out); l++ {
		acc += buf[l-1+size] - buf[l-1]
		out[l] = acc / div
	}
}

// pass applies one 1-D line filter along an axis of a C-order (ny, nx)
// array. It stores the result in T between passes, as scipy does.
func pass[T Float](a []T, ny, nx, axis, before, after int, mode Mode, line func(out, buf []float64)) []T {
	out := make([]T, len(a))
	n, lines, step, stride := ny, nx, 1, nx
	if axis == 1 {
		n, lines, step, stride = nx, ny, nx, 1
	}
	buf := make([]float64, n+before+after)
	res := make([]float64, n)
	for l := range lines {
		base := l * step
		fillLine(buf, func(i int) float64 { return float64(a[base+i*stride]) }, n, before, mode)
		line(res, buf)
		for i, v := range res {
			out[base+i*stride] = T(v)
		}
	}
	return out
}

// Gaussian2D is scipy gaussian_filter on a C-order (ny, nx) array, order 0,
// truncate 4: axis 0 first, then axis 1, with T storage between the passes.
func Gaussian2D[T Float](a []T, ny, nx int, sigma float64, mode Mode) []T {
	if sigma <= 1e-15 {
		return append([]T(nil), a...)
	}
	w := GaussianKernel(sigma)
	r := len(w) / 2
	line := func(out, buf []float64) { correlateLine(out, buf, w) }
	return pass(pass(a, ny, nx, 0, r, r, mode, line), ny, nx, 1, r, r, mode, line)
}

// Gaussian2D32 is Gaussian2D for float32 storage.
func Gaussian2D32(a []float32, ny, nx int, sigma float64, mode Mode) []float32 {
	return Gaussian2D(a, ny, nx, sigma, mode)
}

// Gaussian2D64 is Gaussian2D for float64 storage.
func Gaussian2D64(a []float64, ny, nx int, sigma float64, mode Mode) []float64 {
	return Gaussian2D(a, ny, nx, sigma, mode)
}

// Uniform2D is scipy uniform_filter with one size for both axes and origin 0.
func Uniform2D[T Float](a []T, ny, nx, size int, mode Mode) []T {
	if size <= 1 {
		return append([]T(nil), a...)
	}
	before := size / 2
	after := size - before - 1
	line := func(out, buf []float64) { uniformLine(out, buf, size) }
	return pass(pass(a, ny, nx, 0, before, after, mode, line), ny, nx, 1, before, after, mode, line)
}

// UniformSum2D is uniform_filter(a, size, mode="constant") * size * size,
// the window sum of tree_scales.py. Python multiplies twice in float32.
func UniformSum2D(a []float32, ny, nx, size int) []float32 {
	side := float32(size)
	mean := Uniform2D(a, ny, nx, size, Constant)
	out := make([]float32, len(mean))
	for i, v := range mean {
		out[i] = float32(v*side) * side
	}
	return out
}

// Box3x3 is scipy convolve with a 3x3x1 kernel of ones and mode constant on
// a C-order (nx, ny, nt) array: the spatial spread of the visit activity.
func Box3x3(a []float32, nx, ny, nt int) []float32 {
	out := make([]float32, len(a))
	at := func(i, j, t int) float64 {
		if i < 0 || i >= nx || j < 0 || j >= ny {
			return 0
		}
		return float64(a[(i*ny+j)*nt+t])
	}
	for i := range nx {
		for j := range ny {
			for t := range nt {
				acc := 0.0
				for di := -1; di <= 1; di++ {
					for dj := -1; dj <= 1; dj++ {
						acc += at(i+di, j+dj, t)
					}
				}
				out[(i*ny+j)*nt+t] = float32(acc)
			}
		}
	}
	return out
}

package geo

import "math"

// dd is a double-double value: hi + lo with about 106 bits of precision.
type dd struct{ hi, lo float64 }

func quickTwoSum(a, b float64) dd {
	s := a + b
	return dd{s, b - (s - a)}
}

func twoSum(a, b float64) (float64, float64) {
	s := a + b
	v := s - a
	return s, (a - (s - v)) + (b - v)
}

func (a dd) add(b dd) dd {
	s, e := twoSum(a.hi, b.hi)
	e += a.lo + b.lo
	return quickTwoSum(s, e)
}

func (a dd) mul(b dd) dd {
	p := a.hi * b.hi
	e := math.FMA(a.hi, b.hi, -p)
	e += a.hi*b.lo + a.lo*b.hi
	return quickTwoSum(p, e)
}

func (a dd) div(n float64) dd {
	q1 := a.hi / n
	p := q1 * n
	pe := math.FMA(q1, n, -p)
	r := ((a.hi - p) - pe) + a.lo
	return quickTwoSum(q1, r/n)
}

// cosLimit is the largest argument for the series. Latitudes stay below it.
const cosLimit = 4.0

// Cos gives the cosine rounded to the nearest float64. math.Cos can differ
// in the last bit.
func Cos(x float64) float64 {
	if math.IsNaN(x) || math.Abs(x) > cosLimit {
		return math.Cos(x)
	}
	square := dd{x * x, math.FMA(x, x, -(x * x))}
	sum := dd{1, 0}
	term := dd{1, 0}
	for k := 1; k <= 30; k++ {
		term = term.mul(square).div(float64((2*k - 1) * (2 * k)))
		if k%2 == 1 {
			sum = sum.add(dd{-term.hi, -term.lo})
		} else {
			sum = sum.add(term)
		}
	}
	return sum.hi + sum.lo
}

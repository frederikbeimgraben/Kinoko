package numeric

import "math"

// MapLinearNearest3 is scipy map_coordinates(order=1, mode="nearest") at one
// point of a C-order 3-D float32 array. A coordinate outside clamps to the edge.
func MapLinearNearest3(a []float32, shape [3]int, coord [3]float64) float32 {
	var start [3]int
	var w [3][2]float64
	for d := range 3 {
		c := min(max(coord[d], 0), float64(shape[d]-1))
		s := math.Floor(c)
		start[d] = int(s)
		t := c - s
		w[d] = [2]float64{1 - t, t}
	}
	idx := func(d, k int) int { return min(start[d]+k, shape[d]-1) }
	acc := 0.0
	for k0 := range 2 {
		for k1 := range 2 {
			for k2 := range 2 {
				v := float64(a[(idx(0, k0)*shape[1]+idx(1, k1))*shape[2]+idx(2, k2)])
				v *= w[0][k0]
				v *= w[1][k1]
				v *= w[2][k2]
				acc += v
			}
		}
	}
	return float32(acc)
}

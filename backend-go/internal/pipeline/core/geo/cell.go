package geo

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// CellKey names one cell of a square grid in EPSG:3035, by its column and row.
type CellKey struct{ X, Y int32 }

// String returns the key as the chain writes it: "x_y".
func (c CellKey) String() string { return fmt.Sprintf("%d_%d", c.X, c.Y) }

// ParseCellKey reads a key "x_y".
func ParseCellKey(s string) (CellKey, error) {
	xs, ys, ok := strings.Cut(s, "_")
	x, errX := strconv.ParseInt(xs, 10, 32)
	y, errY := strconv.ParseInt(ys, 10, 32)
	if !ok || errX != nil || errY != nil {
		return CellKey{}, fmt.Errorf("geo: bad cell key %q", s)
	}
	return CellKey{X: int32(x), Y: int32(y)}, nil
}

// CellOf returns the cell of size metres that holds the point x, y, as
// (x // size, y // size) in Python. The point must be finite.
func CellOf(x, y, size float64) CellKey {
	return CellKey{X: int32(FloorDiv(x, size)), Y: int32(FloorDiv(y, size))}
}

// FloorDiv returns x // y for floats, with the algorithm of CPython float_floor_div
// and numpy npy_divmod. It can differ from math.Floor(x/y) by one near a multiple of y.
func FloorDiv(x, y float64) float64 {
	mod := math.Mod(x, y)
	div := (x - mod) / y
	if mod != 0 && (y < 0) != (mod < 0) {
		div -= 1
	}
	if div == 0 {
		return math.Copysign(0, x/y)
	}
	floor := math.Floor(div)
	if div-floor > 0.5 {
		floor += 1
	}
	return floor
}

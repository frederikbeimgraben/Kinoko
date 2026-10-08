// Package geo holds the plane geometry of finds and zones: areas, the
// point-in-polygon test, the grid that hides protected places, and the
// bounding box of a query. Each function is pure.
package geo

import (
	"math"
	"strconv"
	"strings"
)

const (
	earthRadiusM = 6_371_000.0
	// ringMinPoints is the smallest closed ring: a triangle and its first point again.
	ringMinPoints = 4
	degToRad      = math.Pi / 180.0
	radToDeg      = 180.0 / math.Pi
	kmPerDegree   = 111.32
	minCos        = 0.01
)

// Point is a place in degrees.
type Point struct {
	Lon float64
	Lat float64
}

// Ring is a closed line of points. The last point is equal to the first.
type Ring []Point

// Box is a rectangle in degrees.
type Box struct {
	West, South, East, North float64
}

// Radians converts degrees to radians, with the same constant as Python.
func Radians(deg float64) float64 { return deg * degToRad }

// Degrees converts radians to degrees, with the same constant as Python.
func Degrees(rad float64) float64 { return rad * radToDeg }

// Sum adds the values with the compensated sum of Python 3.12 and later.
// The result is equal to the old service to the last bit.
func Sum(values []float64) float64 {
	total, compensation := 0.0, 0.0
	for _, x := range values {
		t := total + x
		if math.Abs(total) >= math.Abs(x) {
			compensation += (total - t) + x
		} else {
			compensation += (x - t) + total
		}
		total = t
	}
	if compensation != 0 && !math.IsInf(compensation, 0) && !math.IsNaN(compensation) {
		total += compensation
	}
	return total
}

func lons(ring Ring) []float64 {
	out := make([]float64, len(ring))
	for i, p := range ring {
		out[i] = p.Lon
	}
	return out
}

func lats(ring Ring) []float64 {
	out := make([]float64, len(ring))
	for i, p := range ring {
		out[i] = p.Lat
	}
	return out
}

// AreaHa gives the area of a ring in hectares. It uses a plane
// approximation at the mean latitude. A ring with less than four points has no area.
func AreaHa(ring Ring) float64 {
	if len(ring) < ringMinPoints {
		return 0
	}
	meanLat := Radians(Sum(lats(ring)) / float64(len(ring)))
	metreLon := Radians(1.0) * earthRadiusM * Cos(meanLat)
	metreLat := Radians(1.0) * earthRadiusM
	total := 0.0
	for i := range len(ring) - 1 {
		first, second := ring[i], ring[i+1]
		total += (first.Lon * metreLon) * (second.Lat * metreLat)
		total -= (second.Lon * metreLon) * (first.Lat * metreLat)
	}
	return math.Abs(total) / 2.0 / 10_000.0
}

// Inside tells if the point is in the ring (ray casting). Horizontal edges do not count.
func Inside(p Point, ring Ring) bool {
	inside := false
	for i := 0; i+1 < len(ring); i++ {
		first, second := ring[i], ring[i+1]
		if (first.Lat > p.Lat) == (second.Lat > p.Lat) {
			continue
		}
		span := second.Lat - first.Lat
		if span == 0 {
			continue
		}
		cut := first.Lon + (p.Lat-first.Lat)/span*(second.Lon-first.Lon)
		if p.Lon < cut {
			inside = !inside
		}
	}
	return inside
}

// Coarse moves a point to a grid of km kilometres. Python rounds half to
// even, so this function does the same.
func Coarse(p Point, km float64) Point {
	stepLat := km / kmPerDegree
	lat := math.RoundToEven(p.Lat/stepLat) * stepLat
	stepLon := stepLat / math.Max(Cos(Radians(lat)), minCos)
	return Point{Lon: math.RoundToEven(p.Lon/stepLon) * stepLon, Lat: lat}
}

// Bounds gives the smallest box that holds the ring. The ring must not be empty.
func Bounds(ring Ring) Box {
	box := Box{West: ring[0].Lon, South: ring[0].Lat, East: ring[0].Lon, North: ring[0].Lat}
	for _, p := range ring[1:] {
		box.West = math.Min(box.West, p.Lon)
		box.South = math.Min(box.South, p.Lat)
		box.East = math.Max(box.East, p.Lon)
		box.North = math.Max(box.North, p.Lat)
	}
	return box
}

// Centroid gives the mean of the points of the ring. The ring must not be empty.
func Centroid(ring Ring) Point {
	n := float64(len(ring))
	return Point{Lon: Sum(lons(ring)) / n, Lat: Sum(lats(ring)) / n}
}

// ParseBox reads "minLon,minLat,maxLon,maxLat". The bool is false when the
// text has another form or when a minimum is larger than its maximum.
func ParseBox(raw string) (Box, bool) {
	parts := strings.Split(raw, ",")
	if len(parts) != ringMinPoints {
		return Box{}, false
	}
	values := make([]float64, len(parts))
	for i, part := range parts {
		value, ok := pyFloat(part)
		if !ok {
			return Box{}, false
		}
		values[i] = value
	}
	box := Box{West: values[0], South: values[1], East: values[2], North: values[3]}
	if box.West > box.East || box.South > box.North {
		return Box{}, false
	}
	return box, true
}

// pyFloat reads a number as Python float() does for decimal text.
func pyFloat(text string) (float64, bool) {
	trimmed := strings.TrimSpace(text)
	if strings.ContainsAny(trimmed, "xX") {
		return 0, false
	}
	value, err := strconv.ParseFloat(strings.ReplaceAll(trimmed, "_", ""), 64)
	if err != nil && !isRange(err) {
		return 0, false
	}
	if strings.Contains(trimmed, "_") && !validUnderscores(trimmed) {
		return 0, false
	}
	return value, true
}

func isRange(err error) bool {
	numErr, ok := err.(*strconv.NumError)
	return ok && numErr.Err == strconv.ErrRange
}

// validUnderscores accepts an underscore only between two digits, as Python does.
func validUnderscores(text string) bool {
	for i := range len(text) {
		if text[i] != '_' {
			continue
		}
		if i == 0 || i == len(text)-1 || !isDigit(text[i-1]) || !isDigit(text[i+1]) {
			return false
		}
	}
	return true
}

func isDigit(b byte) bool { return b >= '0' && b <= '9' }

package geo

import (
	"math"
	"testing"
)

var square = Ring{{10.0, 50.0}, {10.01, 50.0}, {10.01, 50.01}, {10.0, 50.01}, {10.0, 50.0}}

// The expected values come from the Python service (app/shared/geometry.py).
func TestAreaAndCentroidAgreeWithPython(t *testing.T) {
	cases := []struct {
		ring     Ring
		area     float64
		centroid Point
	}{
		{square, 79.46965107421875, Point{10.004, 50.004}},
		{Ring{{8.60, 50.10}, {8.62, 50.10}, {8.62, 50.12}, {8.60, 50.12}, {8.60, 50.10}}, 317.1903477050781, Point{8.608, 50.108}},
		{Ring{{-3.7, 40.4}, {-3.6, 40.45}, {-3.65, 40.5}, {-3.7, 40.4}}, 3528.993801696777, Point{-3.6625, 40.4375}},
	}
	for _, c := range cases {
		if got := AreaHa(c.ring); got != c.area {
			t.Errorf("area %v: %v, expected %v", c.ring, got, c.area)
		}
		if got := Centroid(c.ring); got != c.centroid {
			t.Errorf("centroid %v: %v, expected %v", c.ring, got, c.centroid)
		}
	}
}

func TestAreaAndPointInPolygon(t *testing.T) {
	if math.Abs(AreaHa(square)-79.5) > 79.5*0.05 {
		t.Fatal(AreaHa(square))
	}
	if AreaHa(Ring{{0, 0}}) != 0 {
		t.Fatal("one point has an area")
	}
	if !Inside(Point{10.005, 50.005}, square) {
		t.Fatal("inside point is outside")
	}
	if Inside(Point{11.0, 50.005}, square) {
		t.Fatal("outside point is inside")
	}
}

func TestCoarseRoundsToAGrid(t *testing.T) {
	if Coarse(Point{10.0004, 50.0004}, 1) != Coarse(Point{10.0, 50.0}, 1) {
		t.Fatal("near points differ")
	}
	if Coarse(Point{10.05, 50.05}, 1) == Coarse(Point{10.0, 50.0}, 1) {
		t.Fatal("far points are equal")
	}
}

func TestCoarseAgreesWithPython(t *testing.T) {
	cases := []struct{ in, out Point }{
		{Point{10.0004, 50.0004}, Point{10.006272547898448, 50.0}},
		{Point{8.123456, 50.123456}, Point{8.126918419350993, 50.12576356449874}},
		{Point{-3.7038, 40.4168}, Point{-3.7047730927526152, 40.41501976284585}},
		{Point{0, 0}, Point{0, 0}},
		{Point{179.99, 89.99}, Point{179.66223499820336, 89.99281351060007}},
		{Point{-122.4194, -37.7749}, Point{-122.42157494053305, -37.77398490837226}},
		{Point{8.6, 50.1}, Point{8.598483538722578, 50.098814229249015}},
	}
	for _, c := range cases {
		if got := Coarse(c.in, 1); got != c.out {
			t.Errorf("coarse %v: %v, expected %v", c.in, got, c.out)
		}
	}
}

func TestBoundsAndBox(t *testing.T) {
	if Bounds(square) != (Box{10.0, 50.0, 10.01, 50.01}) {
		t.Fatal(Bounds(square))
	}
	if box, ok := ParseBox("10,50,11,51"); !ok || box != (Box{10, 50, 11, 51}) {
		t.Fatal(box, ok)
	}
	for _, bad := range []string{"10,50,11", "a,b,c,d", "11,50,10,51", "0x1,0,1,1", "1_,0,1,1"} {
		if _, ok := ParseBox(bad); ok {
			t.Errorf("%q is accepted", bad)
		}
	}
	if box, ok := ParseBox(" 1_0 ,50,11,51"); !ok || box.West != 10 {
		t.Fatal(box, ok)
	}
}

func TestSumIsCompensated(t *testing.T) {
	if got := Sum([]float64{0.1, 0.1, 0.1}); got != 0.30000000000000004 {
		t.Fatal(got)
	}
	if got := Sum([]float64{1e100, 1.0, -1e100}); got != 1.0 {
		t.Fatal(got)
	}
}

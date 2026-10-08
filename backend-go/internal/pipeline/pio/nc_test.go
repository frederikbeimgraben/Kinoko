package pio

import (
	"math"
	"slices"
	"sync"
	"testing"
	"time"
)

// ncFixture holds the values that xarray.open_dataset decodes from a fixture.
// testdata/gen_fixtures.py writes the .nc files with Dataset.to_netcdf and the
// expected .json files with xarray.open_dataset (mask and scale on) and pandas normalize().
type ncFixture struct {
	X    []float64 `json:"x"`
	Y    []float64 `json:"y"`
	Days []string  `json:"days"`
	Vars map[string]struct {
		Dtype  string     `json:"dtype"`
		Shape  []int      `json:"shape"`
		Values []*float64 `json:"values"`
	} `json:"vars"`
}

func TestNCMatchesXarray(t *testing.T) {
	for _, name := range []string{"hyras_tiny", "soil_tiny"} {
		t.Run(name, func(t *testing.T) {
			var want ncFixture
			loadJSON(t, "testdata/"+name+".json", &want)
			f, err := OpenNC("testdata/" + name + ".nc")
			if err != nil {
				t.Fatal(err)
			}
			defer f.Close()
			x, y, days, err := f.Coords()
			if err != nil {
				t.Fatal(err)
			}
			if !slices.Equal(x, want.X) || !slices.Equal(y, want.Y) {
				t.Errorf("coords x=%v y=%v", x, y)
			}
			gotDays := make([]string, len(days))
			for i, d := range days {
				gotDays[i] = d.Format("2006-01-02T15:04:05")
			}
			if !slices.Equal(gotDays, want.Days) {
				t.Errorf("days = %v, want %v", gotDays, want.Days)
			}
			for v, w := range want.Vars {
				checkVar(t, f, v, w.Dtype, w.Shape, w.Values)
			}
		})
	}
}

func checkVar(t *testing.T, f *NCFile, v, dtype string, shape []int, want []*float64) {
	t.Helper()
	p, err := f.Packing(v)
	if err != nil {
		t.Fatal(err)
	}
	if p.Wide != (dtype == "float64") {
		t.Errorf("%s: Wide = %v, xarray dtype %s", v, p.Wide, dtype)
	}
	got := make([]float32, len(want))
	if err := f.ReadDays(v, 0, shape[0], got); err != nil {
		t.Fatal(err)
	}
	got64 := make([]float64, len(want))
	if err := f.ReadDays64(v, 0, shape[0], got64); err != nil {
		t.Fatal(err)
	}
	for i, w := range want {
		if w == nil {
			if !math.IsNaN(float64(got[i])) || !math.IsNaN(got64[i]) {
				t.Errorf("%s[%d] = %v / %v, want NaN", v, i, got[i], got64[i])
			}
			continue
		}
		if dtype == "float32" && float64(got[i]) != *w {
			t.Errorf("%s[%d] = %v, want %v", v, i, got[i], *w)
		}
		if got64[i] != *w && !(dtype == "float32" && float32(got64[i]) == float32(*w)) {
			t.Errorf("%s[%d] = %v (float64), want %v", v, i, got64[i], *w)
		}
		if dtype == "float64" && got[i] != float32(*w) {
			t.Errorf("%s[%d] = %v, want float32(%v)", v, i, got[i], *w)
		}
	}
	// A block read from day 1 gives the same values as the whole read.
	frame := len(want) / shape[0]
	part := make([]float32, frame*(shape[0]-1))
	if err := f.ReadDays(v, 1, shape[0]-1, part); err != nil {
		t.Fatal(err)
	}
	for i := range part {
		a, b := part[i], got[frame+i]
		if a != b && !(a != a && b != b) {
			t.Fatalf("%s: block read differs at %d: %v vs %v", v, i, a, b)
		}
	}
}

func TestNCErrors(t *testing.T) {
	if _, err := OpenNC("testdata/missing.nc"); err == nil {
		t.Error("missing file opens")
	}
	f, err := OpenNC("testdata/hyras_tiny.nc")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := f.ReadDays("pr", 4, 2, make([]float32, 24)); err == nil {
		t.Error("read past the time axis gives no error")
	}
	if err := f.ReadDays("pr", 0, 1, make([]float32, 5)); err == nil {
		t.Error("wrong dst size gives no error")
	}
	if err := f.ReadDays("nope", 0, 1, make([]float32, 12)); err == nil {
		t.Error("missing variable gives no error")
	}
	if err := f.ReadDays("x", 0, 1, make([]float32, 3)); err == nil {
		t.Error("1-D variable gives no error")
	}
	dims, err := f.Dims("pr")
	if err != nil || !slices.Equal(dims, []Dim{{"time", 5}, {"y", 4}, {"x", 3}}) {
		t.Errorf("dims = %v, %v", dims, err)
	}
}

func TestNCConcurrentReads(t *testing.T) {
	f, err := OpenNC("testdata/hyras_tiny.nc")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			dst := make([]float32, 60)
			for range 50 {
				if err := f.ReadDays("tas", 0, 5, dst); err != nil {
					t.Error(err)
					return
				}
			}
		})
	}
	wg.Wait()
}

func TestDecodeCFTime(t *testing.T) {
	utc := func(y int, m time.Month, d, h, min int) time.Time { return time.Date(y, m, d, h, min, 0, 0, time.UTC) }
	cases := []struct {
		units, cal string
		v          float64
		want       time.Time
	}{
		{"days since 1951-01-01", "standard", 25566, utc(2020, 12, 30, 0, 0)},
		{"days since 1951-1-1 00:00:00", "gregorian", 0.5, utc(1951, 1, 1, 12, 0)},
		{"hours since 2021-01-01T06:00:00", "gregorian", 1422, utc(2021, 3, 1, 12, 0)},
		{"seconds since 1970-01-01 00:00:00 UTC", "", 86400, utc(1970, 1, 2, 0, 0)},
		{"minutes since 2000-01-01 00:00 +01:00", "proleptic_gregorian", 0, utc(1999, 12, 31, 23, 0)},
		{"Days since 2000-01-01T00:00:00Z", "Standard", -1, utc(1999, 12, 31, 0, 0)},
	}
	for _, c := range cases {
		got, err := DecodeCFTime([]float64{c.v}, c.units, c.cal)
		if err != nil {
			t.Errorf("%q: %v", c.units, err)
			continue
		}
		if !got[0].Equal(c.want) {
			t.Errorf("%q %v = %v, want %v", c.units, c.v, got[0], c.want)
		}
	}
	for _, bad := range [][2]string{{"days since 2000-01-01", "noleap"}, {"fortnights since 2000-01-01", ""}, {"days", ""}} {
		if _, err := DecodeCFTime([]float64{1}, bad[0], bad[1]); err == nil {
			t.Errorf("%v gives no error", bad)
		}
	}
	if !Normalize(utc(2021, 3, 3, 23, 59)).Equal(utc(2021, 3, 3, 0, 0)) {
		t.Error("Normalize does not give midnight")
	}
}

func TestPackingDtypeRules(t *testing.T) {
	f32 := func(v float64) *Att { return &Att{Value: v, Type: NumFloat32} }
	f64 := func(v float64) *Att { return &Att{Value: v, Type: NumFloat64} }
	cases := []struct {
		raw           NumType
		scale, offset *Att
		wide          bool
	}{
		{NumFloat32, nil, nil, false},
		{NumFloat64, nil, nil, true},
		{NumSmallInt, nil, nil, false},
		{NumInt32, nil, nil, true},
		{NumSmallInt, f32(0.01), f32(5), false},
		{NumInt32, f32(0.01), f32(5), true},
		{NumSmallInt, f64(0.1), nil, true},
		{NumSmallInt, f32(0.1), nil, false},
		{NumSmallInt, nil, f32(1), true},
		{NumSmallInt, f32(0.1), f64(1), true},
	}
	for i, c := range cases {
		if got := NewPacking(c.raw, nil, c.scale, c.offset).Wide; got != c.wide {
			t.Errorf("case %d: Wide = %v, want %v", i, got, c.wide)
		}
	}
	p := NewPacking(NumSmallInt, []float64{-32768, math.NaN()}, f32(0.01), f32(5))
	if len(p.Fills) != 1 || !math.IsNaN(float64(p.Decode32(-32768))) {
		t.Errorf("fill is not masked: %+v", p)
	}
}

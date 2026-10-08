package weather

import (
	"compress/gzip"
	"encoding/json"
	"math"
	"os"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// deriveGolden is testdata/derive.json.gz of testdata/gen_golden.py on a random 30-cell, 120-week cube with NaN
// and 2020W53. Values are [week][cell]. full is add_anomalies(add_lags(weather)) as visit_model.py; forecast is
// region_map.py with two forecast weeks; layers is input_layers.wochenwetter.
type deriveGolden struct {
	Cells     []string                `json:"cells"`
	Weeks     [][2]int                `json:"weeks"`
	Input     map[string][][]*float64 `json:"input"`
	LagNames  []string                `json:"lagNames"`
	AnomNames []string                `json:"anomNames"`
	Full      map[string][][]*float64 `json:"full"`
	Layers    map[string][][]*float64 `json:"layers"`
	Forecast  struct {
		Grenze int                     `json:"grenze"`
		Weeks  [][2]int                `json:"weeks"`
		Values map[string][][]*float64 `json:"values"`
	} `json:"forecast"`
}

func loadDeriveGolden(t *testing.T) (deriveGolden, *Cube) {
	t.Helper()
	f, err := os.Open("testdata/derive.json.gz")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = f.Close() }()
	zr, err := gzip.NewReader(f)
	if err != nil {
		t.Fatal(err)
	}
	var g deriveGolden
	if err := json.NewDecoder(zr).Decode(&g); err != nil {
		t.Fatal(err)
	}
	cells := make([]geo.CellKey, len(g.Cells))
	for i, s := range g.Cells {
		if cells[i], err = geo.ParseCellKey(s); err != nil {
			t.Fatal(err)
		}
	}
	weeks := make([]calendar.Week, len(g.Weeks))
	for i, w := range g.Weeks {
		weeks[i] = calendar.Week{Year: w[0], Week: w[1]}
	}
	vars := map[string][]float32{}
	for name, grid := range g.Input {
		vals := make([]float32, 0, len(weeks)*len(cells))
		for _, row := range grid {
			for _, v := range row {
				vals = append(vals, toF32(v))
			}
		}
		vars[name] = vals
	}
	return g, NewCube(cells, weeks, vars)
}

func toF32(v *float64) float32 {
	if v == nil {
		return nan32
	}
	return float32(*v)
}

func compareDerived(t *testing.T, label string, got map[string][]float32, want map[string][][]*float64, nc int) {
	t.Helper()
	for name, grid := range want {
		vals, ok := got[name]
		if !ok {
			t.Errorf("%s: %s missing", label, name)
			continue
		}
		bad := 0
		for w, row := range grid {
			for c, v := range row {
				g := float64(vals[w*nc+c])
				var ok bool
				if v == nil {
					ok = math.IsNaN(g)
				} else {
					ok = math.Abs(g-*v) <= 1e-4*math.Max(1, math.Abs(*v))
				}
				if !ok && bad < 3 {
					t.Errorf("%s: %s week %d cell %d = %v, want %v", label, name, w, c, g, deref(v))
				}
				if !ok {
					bad++
				}
			}
		}
	}
}

func deref(v *float64) float64 {
	if v == nil {
		return math.NaN()
	}
	return *v
}

func TestDeriveMatchesAddLagsAndAnomalies(t *testing.T) {
	g, cube := loadDeriveGolden(t)
	if !slices.Equal(LagNames(), g.LagNames) || !slices.Equal(AnomalyNames(), g.AnomNames) {
		t.Fatalf("names %v %v, want %v %v", LagNames(), AnomalyNames(), g.LagNames, g.AnomNames)
	}
	got, err := Derive(cube, append(LagNames(), AnomalyNames()...))
	if err != nil {
		t.Fatal(err)
	}
	compareDerived(t, "full", got, g.Full, len(cube.Cells))
}

func TestDeriveForecastMatchesRegionMap(t *testing.T) {
	g, cube := loadDeriveGolden(t)
	full := cube.WithForecast(2)
	normals, err := ComputeNormals(full, AnomalyVars)
	if err != nil {
		t.Fatal(err)
	}
	from := slices.IndexFunc(full.Weeks, func(w calendar.Week) bool { return w.ID() > g.Forecast.Grenze })
	crop := full.Restrict(full.Cells, full.Weeks[from])
	if len(crop.Weeks) != len(g.Forecast.Weeks) {
		t.Fatalf("%d weeks, want %d", len(crop.Weeks), len(g.Forecast.Weeks))
	}
	for i, w := range g.Forecast.Weeks {
		if crop.Weeks[i] != (calendar.Week{Year: w[0], Week: w[1]}) {
			t.Fatalf("week %d is %v, want %v", i, crop.Weeks[i], w)
		}
	}
	got, err := DeriveWith(crop, append(LagNames(), AnomalyNames()...), normals)
	if err != nil {
		t.Fatal(err)
	}
	compareDerived(t, "forecast", got, g.Forecast.Values, len(crop.Cells))
}

func TestDeriveMatchesInputLayers(t *testing.T) {
	g, cube := loadDeriveGolden(t)
	names := []string{"paws", "pr_sum2", "pr_sum4", "pr_sum8", "tas_mittel2", "tas_mittel4", "pr_sum4_anom"}
	got, err := Derive(cube, names)
	if err != nil {
		t.Fatal(err)
	}
	compareDerived(t, "layers", got, g.Layers, len(cube.Cells))
}

func TestDeriveRejectsUnknownNames(t *testing.T) {
	_, cube := loadDeriveGolden(t)
	for _, name := range []string{"dem_mean", "snow_lag1"} {
		if _, err := Derive(cube, []string{name}); err == nil {
			t.Errorf("%s: no error", name)
		}
	}
	if _, err := DeriveWith(cube, []string{"tas_anom"}, &Normals{}); err == nil {
		t.Error("no error without normals")
	}
}

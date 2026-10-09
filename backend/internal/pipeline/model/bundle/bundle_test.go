package bundle

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

// expectation is the golden file testdata/expect.json: the calibrated scores of the bundle in
// testdata/bundle_v1 on a float32 matrix, and the isotonic predictions.
type expectation struct {
	X        []*float64 `json:"x"`
	P        []float64  `json:"p"`
	Probe    []float64  `json:"probe"`
	ProbeIso []float64  `json:"probeIso"`
	Ceiling  float64    `json:"ceiling"`
}

func loadExpect(t *testing.T) map[int]expectation {
	t.Helper()
	data, err := os.ReadFile("testdata/expect.json")
	if err != nil {
		t.Fatal(err)
	}
	var out map[int]expectation
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func float32s(v []*float64) []float32 {
	out := make([]float32, len(v))
	for i, p := range v {
		out[i] = float32(math.NaN())
		if p != nil {
			out[i] = float32(*p)
		}
	}
	return out
}

func checkBundle(t *testing.T, b *Bundle, expect map[int]expectation) {
	t.Helper()
	if !slices.Equal(b.HorizonKeys(), []int{0, 2}) {
		t.Fatalf("HorizonKeys = %v", b.HorizonKeys())
	}
	for h, want := range expect {
		hz := b.Horizons[h]
		if hz.Ceiling != want.Ceiling {
			t.Errorf("h%d: ceiling %v, want %v", h, hz.Ceiling, want.Ceiling)
		}
		x := float32s(want.X)
		p, err := hz.Probability(x, len(x)/len(hz.Features), 1)
		if err != nil {
			t.Fatal(err)
		}
		for i := range p {
			if math.Abs(p[i]-want.P[i]) > 1e-12 {
				t.Errorf("h%d row %d: p %.17g, want %.17g", h, i, p[i], want.P[i])
			}
		}
		for i, v := range hz.Isotonic.PredictAll(want.Probe) {
			if v != want.ProbeIso[i] {
				t.Errorf("h%d isotonic(%.17g) = %.17g, want %.17g", h, want.Probe[i], v, want.ProbeIso[i])
			}
		}
	}
	if top := b.Top(); top != max(expect[0].Ceiling, expect[2].Ceiling) {
		t.Errorf("Top = %v", top)
	}
}

func TestLoadGoldenBundle(t *testing.T) {
	b, err := Load("testdata/bundle_v1")
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	checkBundle(t, b, loadExpect(t))
	if b.Slug != "testus-specius" || b.Visits != 800 || b.Format != Format {
		t.Errorf("header = %+v", b)
	}
	m := b.Horizons[0].Metrics
	if m == nil || m.BrierRaw != 0.1 || !math.IsNaN(m.AUCOOF) {
		t.Errorf("metrics = %+v", m)
	}
	lookup := b.Prior.Cell.Lookup()
	key := b.Prior.Cell.Keys[0]
	if rate, n := lookup(key); rate != b.Prior.Cell.Rate[0] || n != b.Prior.Cell.N[0] || n < 1 {
		t.Errorf("Lookup(%q) = %v, %v", key, rate, n)
	}
	if rate, n := lookup("no_such_cell"); !math.IsNaN(rate) || n != 0 {
		t.Errorf("Lookup(missing) = %v, %v", rate, n)
	}
}

func TestSaveRoundTrip(t *testing.T) {
	b, err := Load("testdata/bundle_v1")
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	dir := filepath.Join(t.TempDir(), "v2")
	if err := b.Save(dir); err != nil {
		t.Fatal(err)
	}
	again, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer again.Close()
	checkBundle(t, again, loadExpect(t))
	if got, want := again.Horizons[0].Params.String(), b.Horizons[0].Params.String(); got != want {
		t.Errorf("params %q, want %q", got, want)
	}
	if !slices.Equal(again.Prior.Block.Keys, b.Prior.Block.Keys) {
		t.Error("prior keys differ after the round trip")
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 3 {
		t.Errorf("Save leaves %d files, want 3", len(entries))
	}
}

func TestLoadRejectsBadBundles(t *testing.T) {
	cases := map[string]func(m map[string]any){
		"format":   func(m map[string]any) { m["format"] = 2 },
		"features": func(m map[string]any) { horizon(m, "0")["features"] = []string{"a", "b", "c", "d", "e", "f"} },
		"path":     func(m map[string]any) { horizon(m, "0")["model"] = "../h0.txt" },
		"ceiling":  func(m map[string]any) { horizon(m, "2")["ceiling"] = 1.5 },
		"isotonic": func(m map[string]any) { horizon(m, "2")["isotonic"].(map[string]any)["outOfBounds"] = "nan" },
	}
	src, err := os.ReadFile("testdata/bundle_v1/bundle.json")
	if err != nil {
		t.Fatal(err)
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			var m map[string]any
			if err := json.Unmarshal(src, &m); err != nil {
				t.Fatal(err)
			}
			change(m)
			dir := t.TempDir()
			for _, f := range []string{"h0.txt", "h2.txt"} {
				data, _ := os.ReadFile(filepath.Join("testdata/bundle_v1", f))
				_ = os.WriteFile(filepath.Join(dir, f), data, 0o644)
			}
			data, _ := json.Marshal(m)
			_ = os.WriteFile(filepath.Join(dir, FileName), data, 0o644)
			if b, err := Load(dir); err == nil {
				b.Close()
				t.Fatal("Load accepts the bundle")
			}
		})
	}
}

func horizon(m map[string]any, h string) map[string]any {
	return m["horizons"].(map[string]any)[h].(map[string]any)
}

func TestCalibratedKeepsNaNAndCaps(t *testing.T) {
	hz := Horizon{Ceiling: 0.5, Isotonic: Isotonic{X: []float64{0, 1}, Y: []float64{0, 1}, XMin: 0, XMax: 1, Increasing: true, OutOfBounds: "clip"}}
	got := hz.Calibrated([]float64{math.NaN(), -1, 0.25, 0.9, 7})
	want := []float64{math.NaN(), 0, 0.25, 0.5, 0.5}
	for i := range want {
		if got[i] != want[i] && !(math.IsNaN(got[i]) && math.IsNaN(want[i])) {
			t.Errorf("Calibrated[%d] = %v, want %v", i, got[i], want[i])
		}
	}
	one := Isotonic{X: []float64{0.3}, Y: []float64{0.2}, XMin: 0.3, XMax: 0.3, Increasing: true, OutOfBounds: "clip"}
	if one.Predict(5) != 0.2 {
		t.Error("a one-point curve is not constant")
	}
}

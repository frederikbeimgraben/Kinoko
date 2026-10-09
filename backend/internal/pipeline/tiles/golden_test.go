package tiles

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/airbusgeo/godal"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

// golden is the golden file testdata/golden.json. It and the trees in testdata/render and testdata/coarsen
// hold the rendered field, the coarsened pyramid, the "have" list, a fine raster block and the preview warp.
type golden struct {
	NX, NY       int
	GeoTransform [6]float64
	Render       struct {
		WgsBox [4]float64
		Zoom   int
		Tops   []float64
		Filled [][][3]int
		Have   []map[string][]string
	}
	AutoBounds [4]float64
	AutoSize   [2]int
	BlockCut   struct {
		Box    [4]float64
		Side   int
		Nodata float64
		Pixel  float64
		Shape  [2]int
		Bytes  []uint8
	}
	Coarsen struct {
		Children [][3]int
		Written  [][3]int
	}
}

func loadGolden(t *testing.T) golden {
	t.Helper()
	data, err := os.ReadFile("testdata/golden.json")
	if err != nil {
		t.Fatal(err)
	}
	var g golden
	if err := json.Unmarshal(data, &g); err != nil {
		t.Fatal(err)
	}
	return g
}

// synthetic rebuilds the golden field with the same arithmetic.
func synthetic(g golden) Raster {
	nan := float32(math.NaN())
	one, two := make([]float32, g.NX*g.NY), make([]float32, g.NX*g.NY)
	for i := range g.NY {
		for j := range g.NX {
			k := i*g.NX + j
			one[k], two[k] = nan, nan
			if (i-100)*(i-100)+(j-80)*(j-80) <= 90*90 {
				one[k] = float32(float64((i*37+j*91)%1000) / 1000.0 * 0.8)
			}
			if j >= 30 {
				two[k] = float32(float64((i*13+j*7)%500) / 500.0)
			}
		}
	}
	return Raster{Bands: [][]float32{one, two}, NX: g.NX, NY: g.NY, GeoTransform: g.GeoTransform, EPSG: 3035}
}

func ids(raw [][3]int) []geo.TileID {
	out := make([]geo.TileID, len(raw))
	for i, r := range raw {
		out[i] = geo.TileID{Z: r[0], X: r[1], Y: r[2]}
	}
	return out
}

// compareBytes allows ±1 on at most 0.1 % of the points, for GDAL version drift.
func compareBytes(t *testing.T, name string, got, want []uint8) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s: %d bytes, want %d", name, len(got), len(want))
	}
	off := 0
	for i := range got {
		d := int(got[i]) - int(want[i])
		if d < -1 || d > 1 || (d != 0 && (got[i] == 0 || want[i] == 0)) {
			t.Fatalf("%s: point %d is %d, want %d", name, i, got[i], want[i])
		}
		if d != 0 {
			off++
		}
	}
	if off*1000 > len(got) {
		t.Fatalf("%s: %d points differ by one", name, off)
	}
	if off > 0 {
		t.Logf("%s: %d points differ by one", name, off)
	}
}

func fmtHave(v any) string {
	o := v.(*pyjson.Obj)
	parts := make([]string, 0, o.Len())
	for _, k := range o.Keys() {
		list, _ := o.Get(k)
		parts = append(parts, fmt.Sprintf("%s:%v", k, list))
	}
	return strings.Join(parts, " ")
}

func TestRenderFieldGolden(t *testing.T) {
	g := loadGolden(t)
	r := g.Render
	if z := geo.FinestZoom(500, geo.ZoomCap, geo.ZoomBase); z != r.Zoom {
		t.Fatalf("zoom %d, want %d", z, r.Zoom)
	}
	roots := []string{filepath.Join(t.TempDir(), "band0"), filepath.Join(t.TempDir(), "band1")}
	written, err := RenderFieldTo(NewGDALWarper(), synthetic(g), roots, r.Tops, r.Zoom, geo.ZoomBase, r.WgsBox)
	if err != nil {
		t.Fatal(err)
	}
	for b, w := range written {
		if want := ids(r.Filled[b]); !slices.Equal(w.Filled, want) {
			t.Fatalf("band %d: filled %v, want %v", b, w.Filled, want)
		}
		have := geo.HaveList(w.Filled)
		for z, list := range r.Have[b] {
			got, _ := have.Get(z)
			if !slices.Equal(got.([]string), list) {
				t.Fatalf("band %d zoom %s: have %v, want %v", b, z, got, list)
			}
		}
		for _, id := range w.Filled {
			got, err := ReadTile(roots[b], id)
			if err != nil {
				t.Fatal(err)
			}
			want, err := ReadTile(filepath.Join("testdata/render", fmt.Sprintf("band%d", b)), id)
			if err != nil || want == nil {
				t.Fatalf("golden tile %v: %v", id, err)
			}
			compareBytes(t, fmt.Sprintf("band %d tile %v", b, id), got, want)
		}
	}
}

func TestAutoBoundsGolden(t *testing.T) {
	g := loadGolden(t)
	got, err := AutoBounds3857(NewGDALWarper(), synthetic(g))
	if err != nil {
		t.Fatal(err)
	}
	for i := range got {
		if math.Abs(got[i]-g.AutoBounds[i]) > 1e-3 {
			t.Fatalf("bounds %v, want %v", got, g.AutoBounds)
		}
	}
}

// writeGTiff writes band one of the field with nodata -32767, as the golden source file.
func writeGTiff(t *testing.T, path string, r Raster, nodata float64) {
	t.Helper()
	registerDrivers()
	band := slices.Clone(r.Bands[0])
	for i, v := range band {
		if math.IsNaN(float64(v)) {
			band[i] = float32(nodata)
		}
	}
	ds, err := godal.Create(godal.GTiff, path, 1, godal.Float32, r.NX, r.NY)
	if err != nil {
		t.Fatal(err)
	}
	r.Bands = [][]float32{band}
	if err := describe(ds, r); err != nil {
		t.Fatal(err)
	}
	if err := ds.Bands()[0].SetNoData(nodata); err != nil {
		t.Fatal(err)
	}
	if err := ds.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestBlockCutGolden(t *testing.T) {
	g := loadGolden(t)
	c := g.BlockCut
	path := filepath.Join(t.TempDir(), "nodata.tif")
	writeGTiff(t, path, synthetic(g), c.Nodata)
	got, err := NewGDALWarper().Warp(File(path), BlockCutSwitches(c.Box, c.Pixel, c.Nodata))
	if err != nil {
		t.Fatal(err)
	}
	if got.NY != c.Shape[0] || got.NX != c.Shape[1] {
		t.Fatalf("shape %d×%d, want %v", got.NY, got.NX, c.Shape)
	}
	compareBytes(t, "block", geo.ToBytes(got.Bands[0]), c.Bytes)
}

func copyTree(t *testing.T, from, to string) {
	t.Helper()
	err := filepath.WalkDir(from, func(p string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, _ := filepath.Rel(from, p)
		data, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(filepath.Join(to, rel)), 0o755); err != nil {
			return err
		}
		return os.WriteFile(filepath.Join(to, rel), data, 0o644)
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestCoarsenGolden(t *testing.T) {
	g := loadGolden(t)
	dir := t.TempDir()
	copyTree(t, "testdata/coarsen/input", dir)
	disk := DirStore{Root: filepath.Join(dir, "value"), Weights: filepath.Join(dir, "weight")}
	mem := MemStore{}
	for _, id := range ids(g.Coarsen.Children) {
		tile, err := disk.Get(id)
		if err != nil || tile == nil {
			t.Fatalf("input %v: %v", id, err)
		}
		mem[id] = *tile
	}
	want := ids(g.Coarsen.Written)
	for name, s := range map[string]Store{"disk": disk, "memory": mem} {
		written, err := Coarsen(s, 12, 9)
		if err != nil {
			t.Fatal(err)
		}
		if !slices.Equal(written, want) {
			t.Fatalf("%s: written %v, want %v", name, written, want)
		}
		for _, id := range want {
			got, _ := s.Get(id)
			wantCode, _ := ReadTile("testdata/coarsen/output/value", id)
			wantWeight, _ := ReadTile("testdata/coarsen/output/weight", id)
			if got == nil || !slices.Equal(got.Code, wantCode) || !slices.Equal(got.Weight, wantWeight) {
				t.Fatalf("%s: tile %v differs from the golden pyramid", name, id)
			}
		}
	}
}

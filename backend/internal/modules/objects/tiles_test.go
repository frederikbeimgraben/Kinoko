package objects

import (
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

var tileRing = geo.RingOf([2]float64{10.0, 50.0}, [2]float64{10.02, 50.0}, [2]float64{10.02, 50.02}, [2]float64{10.0, 50.02}, [2]float64{10.0, 50.0})

func writeManifest(t *testing.T, maps, name string, have map[int][]string) {
	t.Helper()
	if err := os.MkdirAll(maps, 0o755); err != nil {
		t.Fatal(err)
	}
	tiles := map[string][]string{}
	for zoom, names := range have {
		tiles[strconv.Itoa(zoom)] = names
	}
	body, _ := json.Marshal(map[string]any{
		"name":  name,
		"top":   0.5,
		"weeks": []any{map[string]any{"year": 2026, "week": 37, "tiles": name + "/2026-37"}},
		"tiles": map[string]any{"have": tiles},
	})
	if err := os.WriteFile(filepath.Join(maps, name+".json"), body, 0o644); err != nil {
		t.Fatal(err)
	}
}

func writeImage(t *testing.T, maps, path string, zoom, x, y int, img image.Image) {
	t.Helper()
	dir := filepath.Join(maps, path, strconv.Itoa(zoom), strconv.Itoa(x))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	file, err := os.Create(filepath.Join(dir, strconv.Itoa(y)+".png"))
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(file, img); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
}

func greyTile(value uint8) image.Image {
	img := image.NewGray(image.Rect(0, 0, tileSize, tileSize))
	for i := range img.Pix {
		img.Pix[i] = value
	}
	return img
}

func mustManifest(t *testing.T, maps string) manifest {
	t.Helper()
	m, ok := readManifest(maps, "boletus-edulis")
	if !ok {
		t.Fatal("no manifest")
	}
	return m
}

func TestReadManifestWithoutAFileIsNone(t *testing.T) {
	if _, ok := readManifest(t.TempDir(), "boletus-edulis"); ok {
		t.Fatal("manifest found")
	}
}

func TestReadManifestWithBrokenJSONIsNone(t *testing.T) {
	maps := t.TempDir()
	if err := os.WriteFile(filepath.Join(maps, "boletus-edulis.json"), []byte("{kaputt"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, ok := readManifest(maps, "boletus-edulis"); ok {
		t.Fatal("manifest found")
	}
}

func TestReadManifestWithoutARequiredFieldIsNone(t *testing.T) {
	if _, ok := parseManifest([]byte(`{"name": "x", "top": 1, "weeks": []}`)); ok {
		t.Fatal("manifest without tiles is accepted")
	}
	if _, ok := parseManifest([]byte(`{"name": "x", "top": 1, "weeks": [], "tiles": {"have": {"z": []}}}`)); ok {
		t.Fatal("manifest with a bad zoom is accepted")
	}
}

func TestFindWeek(t *testing.T) {
	maps := t.TempDir()
	writeManifest(t, maps, "boletus-edulis", map[int][]string{8: {}})
	m := mustManifest(t, maps)
	if _, ok := findWeek(m, 2026, 37); !ok {
		t.Fatal("week 37 not found")
	}
	if _, ok := findWeek(m, 2026, 1); ok {
		t.Fatal("week 1 found")
	}
}

func TestWorldPointRoundTrip(t *testing.T) {
	x, y := toWorldPoint(geo.Point{Lon: 10.0, Lat: 50.0}, 8)
	back := toDegrees(x, y, 8)
	if math.Abs(back.Lon-10.0) > 1e-6 || math.Abs(back.Lat-50.0) > 1e-6 {
		t.Fatal(back)
	}
}

// The expected values come from tiles.py of the Python service.
func TestWorldPointAgreesWithPython(t *testing.T) {
	x, y := toWorldPoint(geo.Point{Lon: 8.61, Lat: 50.11}, 8)
	if x != 34335.40266666667 || y != 22195.003039855153 {
		t.Fatal(x, y)
	}
	if p := toDegrees(34000.5, 22000.5, 8); p != (geo.Point{Lon: 6.77032470703125, Lat: 50.7903108164132}) {
		t.Fatal(p)
	}
}

func TestCellsUnderAgreeWithPython(t *testing.T) {
	ring := geo.RingOf([2]float64{8.60, 50.10}, [2]float64{8.62, 50.10}, [2]float64{8.62, 50.12}, [2]float64{8.60, 50.12}, [2]float64{8.60, 50.10})
	cells := cellsUnder(ring, 8)
	if len(cells) != 18 || cells[0] != (cell{134, 86, 30, 176}) || cells[17] != (cell{134, 86, 32, 181}) {
		t.Fatal(cells)
	}
	cells = cellsUnder(ring, 12)
	if len(cells) != 5310 || cells[0] != (cell{2145, 1387, 217, 3}) || cells[5309] != (cell{2146, 1387, 19, 92}) {
		t.Fatal(len(cells), cells[0], cells[len(cells)-1])
	}
}

func TestCellsUnderASmallRingFallsBackToTheCentre(t *testing.T) {
	tiny := geo.RingOf([2]float64{10.0, 50.0}, [2]float64{10.0001, 50.0}, [2]float64{10.0001, 50.0001}, [2]float64{10.0, 50.0001}, [2]float64{10.0, 50.0})
	if cells := cellsUnder(tiny, 8); len(cells) != 1 {
		t.Fatal(cells)
	}
}

func TestCellOfNegativePixels(t *testing.T) {
	if c := cellOf(-1, -257); c != (cell{-1, -2, 255, 255}) {
		t.Fatal(c)
	}
}

func TestAreaMeanWithoutTilesIsZero(t *testing.T) {
	maps := t.TempDir()
	writeManifest(t, maps, "boletus-edulis", map[int][]string{})
	mean, points, err := areaMean(maps, mustManifest(t, maps), "x", tileRing)
	if err != nil || mean != 0 || points != 0 {
		t.Fatal(mean, points, err)
	}
}

func TestAreaMeanSkipsAMissingTile(t *testing.T) {
	maps := t.TempDir()
	writeManifest(t, maps, "boletus-edulis", map[int][]string{8: {"0/0"}})
	mean, points, err := areaMean(maps, mustManifest(t, maps), "boletus-edulis/2026-37", tileRing)
	if err != nil || mean != 0 || points != 0 {
		t.Fatal(mean, points, err)
	}
}

func TestAreaMeanReadsTheTile(t *testing.T) {
	maps := t.TempDir()
	cells := cellsUnder(tileRing, 8)
	writeManifest(t, maps, "boletus-edulis", map[int][]string{8: {fmt.Sprintf("%d/%d", cells[0].TileX, cells[0].TileY)}})
	writeImage(t, maps, "boletus-edulis/2026-37", 8, cells[0].TileX, cells[0].TileY, greyTile(255))
	mean, points, err := areaMean(maps, mustManifest(t, maps), "boletus-edulis/2026-37", tileRing)
	if err != nil || points != len(cells) || math.Abs(mean-50.0) > 0.5 {
		t.Fatal(mean, points, err)
	}
}

func TestAByteOfZeroCountsAsNoData(t *testing.T) {
	maps := t.TempDir()
	cells := cellsUnder(tileRing, 8)
	writeManifest(t, maps, "boletus-edulis", map[int][]string{8: {fmt.Sprintf("%d/%d", cells[0].TileX, cells[0].TileY)}})
	writeImage(t, maps, "boletus-edulis/2026-37", 8, cells[0].TileX, cells[0].TileY, greyTile(0))
	mean, points, err := areaMean(maps, mustManifest(t, maps), "boletus-edulis/2026-37", tileRing)
	if err != nil || mean != 0 || points != 0 {
		t.Fatal(mean, points, err)
	}
}

func TestLumaIsPillowL(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.NRGBA{R: 200, G: 100, B: 50, A: 10})
	// Pillow: Image.new("RGBA", (1, 1), (200, 100, 50, 10)).convert("L").getpixel((0, 0)) == 124
	if got := luma(img, 0, 0); got != 124 {
		t.Fatal(got)
	}
}

func TestLayerNamesWithoutAFile(t *testing.T) {
	dir := t.TempDir()
	if len(layerNames(dir)) != 0 || len(mapNames(filepath.Join(dir, "fehlt"))) != 0 {
		t.Fatal("names found")
	}
}

func TestLayerNamesReadsTheIndex(t *testing.T) {
	dir := t.TempDir()
	body := `{"layers": {"rain": {"label": "Regen", "unit": "mm"}}}`
	if err := os.WriteFile(filepath.Join(dir, "layers.json"), []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	names := layerNames(dir)
	if _, ok := names["rain"]; !ok || len(names) != 1 {
		t.Fatal(names)
	}
}

func TestBrokenLayerIndexIsEmpty(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "layers.json"), []byte("[]"), 0o644); err != nil {
		t.Fatal(err)
	}
	if len(layerNames(dir)) != 0 {
		t.Fatal("names found")
	}
}

func TestMapNamesComeFromTheManifests(t *testing.T) {
	dir := t.TempDir()
	writeManifest(t, dir, "boletus-edulis", map[int][]string{8: {}})
	if err := os.WriteFile(filepath.Join(dir, "layers.json"), []byte(`{"layers": {}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	names := mapNames(dir)
	if _, ok := names["boletus-edulis"]; !ok || len(names) != 1 {
		t.Fatal(names)
	}
}

func TestCheckSources(t *testing.T) {
	dir := t.TempDir()
	if errs := checkSources(dir, []string{"rain"}); len(errs) != 0 {
		t.Fatal(errs)
	}
	writeManifest(t, dir, "boletus-edulis", map[int][]string{8: {}})
	if errs := checkSources(dir, []string{"boletus-edulis"}); len(errs) != 0 {
		t.Fatal(errs)
	}
	errs := checkSources(dir, []string{"gibt-es-nicht"})
	if !slices.Equal(errs, []problem.FieldError{{Field: "factors.0.source", Code: "unknown_source"}}) {
		t.Fatal(errs)
	}
}

func TestStoredFactorsIsPythonJSONDumps(t *testing.T) {
	got := storedFactors([]factor{
		{Source: "a\"b\\\n\x01\x7f\u00e9\U0001f600/", Condition: "above", Low: fn.Ptr(9.0), High: nil, Active: true},
		{Source: "x", Condition: "below", Low: fn.Ptr(1e-07), High: fn.Ptr(1e16), Active: false},
	})
	want := `[{"source": "a\"b\\\n\u0001\u007f\u00e9\ud83d\ude00/", "condition": "above", "low": 9.0, "high": null, "active": true}, ` +
		`{"source": "x", "condition": "below", "low": 1e-07, "high": 1e+16, "active": false}]`
	if got != want {
		t.Fatalf("%s\nexpected %s", got, want)
	}
}

func TestStoredPolygonUsesPythonFloats(t *testing.T) {
	p := polygon{Type: "Polygon", Coordinates: [][][]float64{{{9, 48.5}, {0.00001, 123456789012345.6}}}}
	if got := p.stored(); got != `{"type":"Polygon","coordinates":[[[9.0,48.5],[1e-05,123456789012345.6]]]}` {
		t.Fatal(got)
	}
	if got := (polygon{}).stored(); got != `{"type":"Polygon","coordinates":[]}` {
		t.Fatal(got)
	}
}

func TestParseLaxIntRejectsWhatInt64CannotHold(t *testing.T) {
	good := map[string]int64{"3": 3, "3.0": 3, "1e3": 1000, `"7"`: 7, "9007199254740993": 9007199254740993,
		"-9223372036854775808": math.MinInt64}
	for in, want := range good {
		if got, ok := parseLaxInt([]byte(in)); !ok || got != want {
			t.Errorf("%s: %d %v", in, got, ok)
		}
	}
	for _, in := range []string{"1e19", "10000000000000000000", "9223372036854775808", "9.3e18", "-1e19", "3.5", "NaN", "x"} {
		if got, ok := parseLaxInt([]byte(in)); ok {
			t.Errorf("%s: %d", in, got)
		}
	}
}

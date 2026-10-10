package sources

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

func TestTreesGridValidator(t *testing.T) {
	good := TreesGridColumns(5)
	replace := func(name string, values any) []Column {
		return fn.Map(good, func(c Column) Column {
			if c.Name == name {
				return Column{name, values}
			}
			return c
		})
	}
	cases := []struct {
		name    string
		data    []byte
		minRows int64
		code    string
	}{
		{"good", ParquetBytes(t, good), 1, ""},
		{"not parquet", []byte("x,y\n1,2\n"), 1, "parquet"},
		{"missing column", ParquetBytes(t, good[1:]), 1, "schema"},
		{"too few rows", ParquetBytes(t, good), 6, "row_count"},
		{"x off the grid", ParquetBytes(t, replace("x", []float64{4_000_250, 4_000_750, 4_001_000, 4_001_750, 4_002_250})), 1, "grid"},
		{"duplicate cell", ParquetBytes(t, replace("cell", []string{"a", "b", "c", "a", "e"})), 1, "duplicate_cell"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			v := VersionOn(t, KindTreesGrid, "grid.parquet", c.data)
			meta, err := treesGrid{minRows: c.minRows, maxRows: 10}.Validate(t.Context(), v)
			if FailCode(err) != c.code {
				t.Fatal(err)
			}
			if c.code == "" && (meta["rows"] != int64(5) || fmt.Sprint(meta["bbox"]) != "[4.00025e+06 3.00025e+06 4.00225e+06 3.00025e+06]") {
				t.Fatal(meta)
			}
		})
	}
}

// stubResolver gives one path for each artifact, or ErrMissing.
type stubResolver struct{ path string }

func (s stubResolver) Active(Kind, string) (*Version, error) { return nil, ErrMissing }

func (s stubResolver) Path(Kind, string) (string, error) {
	if s.path == "" {
		return "", ErrMissing
	}
	return s.path, nil
}

func scaleFixture(rows int, float64Column string) []Column {
	share := make([]float32, rows)
	cells := fn.Map(make([]int, rows), func(int) string { return "c" })
	xs := make([]float64, rows)
	out := []Column{{"cell", cells}, {"x", xs}, {"y", xs}}
	for _, name := range scaleColumns() {
		if name == float64Column {
			out = append(out, Column{name, make([]float64, rows)})
			continue
		}
		out = append(out, Column{name, share})
	}
	return out
}

func TestTreeScalesValidator(t *testing.T) {
	grid := filepath.Join(t.TempDir(), "grid.parquet")
	WriteParquet(t, grid, TreesGridColumns(3))
	if n := len(scaleColumns()) + 3; n != 59 {
		t.Fatalf("%d columns", n)
	}
	cases := []struct {
		name    string
		columns []Column
		grid    string
		code    string
	}{
		{"no grid to compare", scaleFixture(4, ""), "", ""},
		{"same rows as the grid", scaleFixture(3, ""), grid, ""},
		{"other rows than the grid", scaleFixture(4, ""), grid, "row_count"},
		{"float64 column", scaleFixture(3, "tree_oak_2km"), "", "schema"},
		{"missing column", scaleFixture(3, "")[1:], "", "schema"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			v := VersionOn(t, KindTreeScales, "scales.parquet", ParquetBytes(t, c.columns))
			_, err := treeScales{resolve: stubResolver{c.grid}}.Validate(t.Context(), v)
			if FailCode(err) != c.code {
				t.Fatal(err)
			}
		})
	}
}

func TestSiteGridValidator(t *testing.T) {
	good := []Column{{"cell", []string{"a", "b"}}, {"soil_phh2o_0_5cm", []float32{5.5, 6}}, {"tpi_25km", []float32{0, 1}}}
	v := VersionOn(t, KindSiteGrid, "site.parquet", ParquetBytes(t, good))
	meta, err := siteGrid{}.Validate(t.Context(), v)
	if err != nil || fmt.Sprint(meta["optional"]) != "[tpi_25km]" {
		t.Fatal(meta, err)
	}
	artifacts, err := siteGrid{}.Derive(t.Context(), v)
	if err != nil || len(artifacts) != 1 || artifacts[0].Name != "site_500m" || artifacts[0].Path != v.Original() {
		t.Fatal(artifacts, err)
	}
	v = VersionOn(t, KindSiteGrid, "site.parquet", ParquetBytes(t, []Column{good[0], good[2]}))
	if _, err := (siteGrid{}).Validate(t.Context(), v); FailCode(err) != "schema" {
		t.Fatal(err)
	}
}

func box(lon0, lat0, lon1, lat1 float64) [][][2]float64 {
	return [][][2]float64{{{lon0, lat0}, {lon1, lat0}, {lon1, lat1}, {lon0, lat1}, {lon0, lat0}}}
}

func geoJSON(t *testing.T, doc any) []byte {
	t.Helper()
	data, err := json.Marshal(doc)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func TestOutlineValidator(t *testing.T) {
	germanSized := box(6, 47.5, 14, 53.3)
	feature := map[string]any{"type": "Feature", "properties": map[string]any{},
		"geometry": map[string]any{"type": "MultiPolygon", "coordinates": [][][][2]float64{germanSized}}}
	square := map[string]any{"type": "Polygon", "coordinates": box(4_000_000, 3_000_000, 4_600_000, 3_600_000),
		"crs": map[string]any{"type": "name", "properties": map[string]any{"name": "urn:ogc:def:crs:EPSG::3035"}}}
	cases := []struct {
		name string
		doc  any
		code string
	}{
		{"feature collection in degrees", map[string]any{"type": "FeatureCollection", "features": []any{feature}}, ""},
		{"square in EPSG:3035", square, ""},
		{"too small", map[string]any{"type": "Polygon", "coordinates": box(9, 50, 10, 51)}, "area"},
		{"open ring", map[string]any{"type": "Polygon", "coordinates": [][][2]float64{{{6, 47}, {14, 47}, {14, 53}, {6, 53}}}}, "geometry"},
		{"point", map[string]any{"type": "Point", "coordinates": []float64{9, 50}}, "geometry"},
		{"other CRS", map[string]any{"type": "Polygon", "coordinates": germanSized,
			"crs": map[string]any{"type": "name", "properties": map[string]any{"name": "EPSG:31467"}}}, "crs_unsupported"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			v := VersionOn(t, KindGermanyOutline, "de.geojson", geoJSON(t, c.doc))
			meta, err := outline{minKm2: germanyMinKm2, maxKm2: germanyMaxKm2}.Validate(t.Context(), v)
			if FailCode(err) != c.code {
				t.Fatal(err)
			}
			if c.code == "" && meta["polygons"] != 1 {
				t.Fatal(meta)
			}
		})
	}
	v := VersionOn(t, KindGermanyOutline, "de.geojson", []byte("{"))
	if _, err := (outline{}).Validate(t.Context(), v); FailCode(err) != "geojson" {
		t.Fatal(err)
	}
}

func TestOutlineAreaIsTrueArea(t *testing.T) {
	// One degree of latitude by one of longitude at 50° N is about 7,960 km².
	km2 := polygonArea(box(9, 49.5, 10, 50.5), false) / 1e6
	if km2 < 7900 || km2 > 8000 {
		t.Fatal(km2)
	}
}

// weeklyFixture gives one checkpoint with two cells for each week.
func weeklyFixture(t *testing.T, name string, weeks []isoWeek) []byte {
	years := fn.FlatMap(weeks, func(w isoWeek) []int64 { return []int64{int64(w.year), int64(w.year)} })
	numbers := fn.FlatMap(weeks, func(w isoWeek) []int64 { return []int64{int64(w.week), int64(w.week)} })
	cells := fn.FlatMap(weeks, func(isoWeek) []string { return []string{"1_1", "1_2"} })
	values := make([]float32, len(cells))
	return ParquetBytes(t, []Column{{"iso_year", years}, {"iso_week", numbers}, {"cell", cells}, {name, values}})
}

func TestWeatherCheckpointsValidator(t *testing.T) {
	span := []isoWeek{{2020, 52}, {2020, 53}, {2021, 1}, {2021, 2}}
	archive := func(weeks func(name string) []isoWeek, skip string) []byte {
		files := map[string][]byte{}
		for _, name := range weeklyNames {
			if name != skip {
				files["weekly/"+name+".parquet"] = weeklyFixture(t, name, weeks(name))
			}
		}
		return ZipOf(t, files)
	}
	all := func(string) []isoWeek { return span }
	v := VersionOn(t, KindWeatherCheckpoints, "weekly.zip", archive(all, ""))
	meta, err := weatherCheckpoints{}.Validate(t.Context(), v)
	if err != nil {
		t.Fatal(err)
	}
	pr := meta["weeks"].(map[string]any)["pr"].(map[string]any)
	if pr["from"] != "2020-W52" || pr["to"] != "2021-W02" || pr["rows"] != int64(8) {
		t.Fatal(pr)
	}
	artifacts, err := weatherCheckpoints{}.Derive(t.Context(), v)
	if err != nil || len(artifacts) != 12 || artifacts[0].Name != "weekly/pr" || artifacts[0].SizeBytes == 0 {
		t.Fatal(artifacts, err)
	}
	withGap := func(name string) []isoWeek {
		if name == "hurs" {
			return []isoWeek{{2020, 52}, {2021, 1}}
		}
		return span
	}
	v = VersionOn(t, KindWeatherCheckpoints, "weekly.zip", archive(withGap, ""))
	if _, err := (weatherCheckpoints{}).Validate(t.Context(), v); FailCode(err) != "weeks" {
		t.Fatal(err)
	}
	v = VersionOn(t, KindWeatherCheckpoints, "weekly.zip", archive(all, "frost_days"))
	if _, err := (weatherCheckpoints{}).Validate(t.Context(), v); FailCode(err) != "missing_files" {
		t.Fatal(err)
	}
	v = VersionOn(t, KindWeatherCheckpoints, "weekly.zip", []byte("not a zip"))
	if _, err := (weatherCheckpoints{}).Validate(t.Context(), v); FailCode(err) != "zip" {
		t.Fatal(err)
	}
}

func pngOf(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, img); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func TestStaticLayersValidator(t *testing.T) {
	gray := pngOf(t, image.NewGray(image.Rect(0, 0, 256, 256)))
	manifest := func(have map[string][]string) []byte {
		return geoJSON(t, map[string]any{"layers": map[string]any{
			"hoehe": map[string]any{"static": true, "tiles": "layers_kacheln/hoehe", "zooms": []int{5, 12},
				"haveZoom": 6, "have": have},
		}})
	}
	have := map[string][]string{"5": {"16/10"}, "6": {"33/21"}}
	files := map[string][]byte{
		"layers.json":                      manifest(have),
		"layers_kacheln/hoehe/5/16/10.png": gray,
		"layers_kacheln/hoehe/6/33/21.png": gray,
		"layers_kacheln/hoehe/7/66/42.png": gray,
	}
	v := VersionOn(t, KindStaticLayers, "layers.zip", ZipOf(t, files))
	meta, err := staticLayers{}.Validate(t.Context(), v)
	if err != nil || fmt.Sprint(meta["layers"]) != "[map[name:hoehe tiles:3]]" {
		t.Fatal(meta, err)
	}
	artifacts, err := staticLayers{}.Derive(t.Context(), v)
	if err != nil || len(artifacts) != 2 || artifacts[1].Name != "layers_kacheln/hoehe" || artifacts[1].SizeBytes != 3*int64(len(gray)) {
		t.Fatal(artifacts, err)
	}
	if _, err := os.Stat(filepath.Join(v.DerivedDir(), "layers_kacheln/hoehe/7/66/42.png")); err != nil {
		t.Fatal(err)
	}
	broken := []struct {
		name   string
		change func(map[string][]byte)
		code   string
	}{
		{"listed tile is missing", func(f map[string][]byte) { delete(f, "layers_kacheln/hoehe/6/33/21.png") }, "tiles"},
		{"unlisted tile", func(f map[string][]byte) { f["layers_kacheln/hoehe/6/33/22.png"] = gray }, "tiles"},
		{"colour tile", func(f map[string][]byte) {
			f["layers_kacheln/hoehe/7/66/42.png"] = pngOf(t, image.NewRGBA(image.Rect(0, 0, 256, 256)))
		}, "tiles"},
		{"small tile", func(f map[string][]byte) {
			f["layers_kacheln/hoehe/7/66/42.png"] = pngOf(t, image.NewGray(image.Rect(0, 0, 128, 128)))
		}, "tiles"},
		{"layer without entry", func(f map[string][]byte) { f["layers_kacheln/wald/5/16/10.png"] = gray }, "manifest"},
		{"no manifest", func(f map[string][]byte) { delete(f, "layers.json") }, "missing_files"},
		{"unsafe path", func(f map[string][]byte) { f["../evil.png"] = gray }, "zip"},
	}
	for _, c := range broken {
		t.Run(c.name, func(t *testing.T) {
			changed := map[string][]byte{}
			for k, value := range files {
				changed[k] = value
			}
			c.change(changed)
			v := VersionOn(t, KindStaticLayers, "layers.zip", ZipOf(t, changed))
			if _, err := (staticLayers{}).Validate(t.Context(), v); FailCode(err) != c.code {
				t.Fatal(err)
			}
		})
	}
}

func TestMatchChainsTakesTheFirstKnownTaxon(t *testing.T) {
	reizker := db.MustID("00000000-0000-0000-0000-000000000001")
	byLatin := map[string]db.ID{"lactarius deterrimus": reizker, "boletus edulis": db.NewID()}
	rows := matchChains(Chains, byLatin)
	if len(rows) != 2 || rows[0].Chain.Key != "boletus_edulis" || rows[1].Chain.Key != "reizker" || rows[1].SpeciesID != reizker {
		t.Fatal(rows)
	}
	last := Chains[len(Chains)-1]
	if last.Key != "schopftintling" || last.MinForest != 0 || len(Chains) != 11 {
		t.Fatal(last)
	}
}

func TestDefaultChainUsesTheLatinName(t *testing.T) {
	c := DefaultChain(" Imleria  badia ")
	if c.Key != "imleria_badia" || len(c.Taxa) != 1 || c.Taxa[0] != "Imleria badia" || c.MinForest != defaultMinForest {
		t.Fatal(c)
	}
	if ChainKey("Boletus edulis") != Chains[0].Key {
		t.Fatal(ChainKey("Boletus edulis"))
	}
	lachs := DefaultChain("Lactarius salmonicolor")
	if lachs.Key != "lactarius_salmonicolor" || len(lachs.Taxa) != 4 || lachs.Taxa[0] != "Lactarius deliciosus" {
		t.Fatal(lachs)
	}
}

func TestISOWeeks(t *testing.T) {
	if weeksIn(2020) != 53 || weeksIn(2021) != 52 {
		t.Fatal(weeksIn(2020), weeksIn(2021))
	}
	if (isoWeek{2020, 53}).next() != (isoWeek{2021, 1}) || (isoWeek{2021, 52}).next() != (isoWeek{2022, 1}) {
		t.Fatal("next week")
	}
	if missing, found := gap([]isoWeek{{2021, 51}, {2022, 1}}); !found || missing != (isoWeek{2021, 52}) {
		t.Fatal(missing, found)
	}
}

func TestLastLines(t *testing.T) {
	if got := lastLines("a\nb\nc\n", 2); fmt.Sprint(got) != "[b c]" {
		t.Fatal(got)
	}
	if got := lastLines("", 2); len(got) != 0 {
		t.Fatal(got)
	}
}

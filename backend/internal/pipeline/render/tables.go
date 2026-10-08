package render

import (
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// Tables are the static grid tables (sources trees-grid, tree-scales, site-grid).
type Tables struct {
	// Trees holds x, y and forest_fraction of each 500 m cell.
	Trees *pio.Table
	// Scales holds cell and the tree-scale feature columns. Nil for the layers.
	Scales *pio.Table
	// Site holds cell and soil_phh2o_0_5cm. Nil turns the water mask off, as a missing site_500m.parquet.
	Site *pio.Table
}

// LoadTables reads the columns that the map needs. An empty path skips that table.
// Of scaleCols only the columns that the file has are read.
func LoadTables(treesPath, scalesPath, sitePath string, scaleCols []string) (Tables, error) {
	t, err := LoadGrids(treesPath, sitePath)
	if err != nil || scalesPath == "" {
		return t, err
	}
	if t.Scales, err = LoadScales(scalesPath, scaleCols); err != nil {
		return Tables{}, err
	}
	return t, nil
}

// LoadGrids reads the trees grid and the site grid, the tables of each map and of the layers.
// An empty sitePath skips the site grid.
func LoadGrids(treesPath, sitePath string) (Tables, error) {
	var t Tables
	var err error
	if t.Trees, err = readSome(treesPath, []string{"x", "y", "forest_fraction"}, []string{"x", "y"}); err != nil {
		return Tables{}, err
	}
	if sitePath != "" {
		if t.Site, err = readSome(sitePath, []string{"cell", "soil_phh2o_0_5cm"}, []string{"cell", "soil_phh2o_0_5cm"}); err != nil {
			return Tables{}, err
		}
	}
	return t, nil
}

// LoadScales reads cell and the columns of cols that the tree-scales file has.
func LoadScales(path string, cols []string) (*pio.Table, error) {
	return readSome(path, append([]string{"cell"}, cols...), []string{"cell"})
}

// readSome reads the wanted columns that the file has. Each required column must exist.
func readSome(path string, wanted, required []string) (*pio.Table, error) {
	info, err := pio.Inspect(path)
	if err != nil {
		return nil, err
	}
	specs := make([]pio.ColumnSpec, len(required))
	for i, name := range required {
		specs[i] = pio.ColumnSpec{Name: name, Type: pio.Any}
	}
	if err := info.Require(specs); err != nil {
		return nil, err
	}
	have := make([]string, 0, len(info.Columns))
	for _, c := range info.Columns {
		have = append(have, c.Name)
	}
	var cols []string
	for _, name := range wanted {
		if slices.Contains(have, name) && !slices.Contains(cols, name) {
			cols = append(cols, name)
		}
	}
	return pio.ReadParquet(path, cols)
}

// ScaleColumns returns the tree-scale columns that a map reads: the features of
// each horizon of each bundle plus forest_fraction_500m, sorted, as region_map.py.
// LoadTables drops the names that are not in the file, such as the weather features.
func ScaleColumns(bundles ...*bundle.Bundle) []string {
	var features []string
	for _, b := range bundles {
		features = append(features, featureUnion(b)...)
	}
	return ScaleColumnsOf(features)
}

// ScaleColumnsOf is ScaleColumns for a list of feature names.
func ScaleColumnsOf(features []string) []string {
	out := append([]string{"forest_fraction_500m"}, features...)
	slices.Sort(out)
	return slices.Compact(out)
}

// floats returns a float column as float64.
func floats(t *pio.Table, name string) ([]float64, bool) {
	if v, ok := t.F64[name]; ok {
		return v, true
	}
	if v, ok := t.F32[name]; ok {
		out := make([]float64, len(v))
		for i, x := range v {
			out[i] = float64(x)
		}
		return out, true
	}
	if v, ok := t.I64[name]; ok {
		out := make([]float64, len(v))
		for i, x := range v {
			out[i] = float64(x)
		}
		return out, true
	}
	return nil, false
}

// float32s returns a numeric column as float32, as to_numpy(dtype="float32").
func float32s(t *pio.Table, name string) ([]float32, bool) {
	if v, ok := t.F32[name]; ok {
		return v, true
	}
	v, ok := floats(t, name)
	if !ok {
		return nil, false
	}
	out := make([]float32, len(v))
	for i, x := range v {
		out[i] = float32(x)
	}
	return out, true
}

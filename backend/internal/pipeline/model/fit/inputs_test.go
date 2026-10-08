package fit

import (
	"context"
	"path/filepath"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
)

func TestReadTreeScalesKeepsFileOrder(t *testing.T) {
	path := filepath.Join(t.TempDir(), "tree_scales.parquet")
	tab := pio.NewTable(2)
	tab.Str["cell"] = []string{"1_2", "3_4"}
	tab.F64["x"], tab.F64["y"] = []float64{750, 1750}, []float64{1250, 2250}
	tab.F32["tree_oak_1km"] = []float32{0.5, 0.25}
	tab.F64["forest_fraction_500m"] = []float64{1, 0.125}
	schema := []pio.ColumnSpec{{Name: "cell", Type: pio.String}, {Name: "x", Type: pio.Float64}, {Name: "tree_oak_1km", Type: pio.Float32},
		{Name: "y", Type: pio.Float64}, {Name: "forest_fraction_500m", Type: pio.Float64}}
	if err := pio.WriteParquet(path, tab, schema); err != nil {
		t.Fatal(err)
	}
	ts, err := ReadTreeScales(path)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(ts.Columns, []string{"tree_oak_1km", "forest_fraction_500m"}) || !slices.Equal(ts.Cells, tab.Str["cell"]) ||
		!slices.Equal(ts.Values["forest_fraction_500m"], []float32{1, 0.125}) {
		t.Errorf("ReadTreeScales = %+v", ts)
	}
}

func TestCubeWeatherRestrictsCells(t *testing.T) {
	cells := []geo.CellKey{{X: 1, Y: 1}, {X: 2, Y: 2}}
	weeks := []calendar.Week{{Year: 2020, Week: 1}, {Year: 2020, Week: 2}}
	cube := weather.NewCube(cells, weeks, map[string][]float32{"pr": {1, 2, 3, 4}})
	got, err := CubeWeather{All: cube}.Cube(context.Background(), []geo.CellKey{{X: 2, Y: 2}, {X: 9, Y: 9}})
	if err != nil || len(got.Cells) != 1 || !slices.Equal(got.Vars["pr"], []float32{2, 4}) {
		t.Errorf("Cube = %+v, %v", got, err)
	}
	if _, err := (CubeWeather{}).Cube(context.Background(), cells); err == nil {
		t.Error("an empty CubeWeather gives a cube")
	}
}

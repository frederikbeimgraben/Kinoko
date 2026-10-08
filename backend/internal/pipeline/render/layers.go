package render

import (
	"context"
	"fmt"
	"math"
	"path/filepath"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/hist"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/numeric"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/tiles"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
)

// WeeklyLayer is one entry of WEEKLY in input_layers.py.
type WeeklyLayer struct{ Name, Column, Label, Unit string }

// WeeklyLayers are the weekly input layers in the order of the chooser of the page.
var WeeklyLayers = []WeeklyLayer{
	{"regen", "pr", "Niederschlag der Woche", "mm"},
	{"regen_2w", "pr_sum2", "Niederschlag der letzten 2 Wochen", "mm"},
	{"regen_4w", "pr_sum4", "Niederschlag der letzten 4 Wochen", "mm"},
	{"regen_8w", "pr_sum8", "Niederschlag der letzten 8 Wochen", "mm"},
	{"regen_anomalie", "pr_sum4_anom", "Regen der letzten 4 Wochen gegen normal", "mm"},
	{"regen_tage_seit", "days_since_rain", "Tage seit dem letzten Regen ueber 5 mm", "Tage"},
	{"temperatur", "tas", "Mitteltemperatur der Woche", "Grad"},
	{"temperatur_min", "tasmin", "Tiefsttemperatur der Woche", "Grad"},
	{"temperatur_max", "tasmax", "Hoechsttemperatur der Woche", "Grad"},
	{"temperatur_2w", "tas_mittel2", "Mitteltemperatur der letzten 2 Wochen", "Grad"},
	{"temperatur_4w", "tas_mittel4", "Mitteltemperatur der letzten 4 Wochen", "Grad"},
	{"frosttage", "frost_days", "Frosttage der Woche, unter 0 Grad", "Tage"},
	{"hitzetage", "heat_days", "Hitzetage der Woche, ueber 25 Grad", "Tage"},
	{"luftfeuchte", "hurs", "Luftfeuchte der Woche", "%"},
	{"bodenfeuchte", "paws", "Bodenwasser fuer Pflanzen, Mittel ueber vier Baumarten", "% nFK"},
}

// FixedRange holds the layers whose scale comes from their definition, not from the data.
var FixedRange = map[string][2]float64{
	"regen_tage_seit": {0, 60},
	"frosttage":       {0, 7},
	"hitzetage":       {0, 7},
}

// WeeklyResolution is the smoothing width of the weather on the map, in metres:
// the cell of the weather times numeric.SigmaCells.
const WeeklyResolution = int(TrainCell * numeric.SigmaCells)

// LayerInputs are the data of the weekly layers.
type LayerInputs struct {
	// Tables needs Trees (x, y) and Site (cell, soil_phh2o_0_5cm).
	Tables Tables
	// Weather holds the observed weeks of the raw weekly variables over the full record.
	Weather *weather.Cube
	Warper  tiles.Warper
}

// LayerConfig holds the settings of the weekly layers.
type LayerConfig struct {
	Maps    string
	Step    int
	Weeks   int
	ZoomCap int
	Log     Logger
}

// DefaultLayerConfig returns the settings of update.sh.
func DefaultLayerConfig(maps string) LayerConfig {
	return LayerConfig{Maps: maps, Step: DefaultStep, Weeks: DefaultWeeks, ZoomCap: geo.ZoomCap}
}

// Layers draws the weekly input layers as input_layers.py --only-weekly --tiles.
// It keeps the static entries of layers.json in their order, writes the week tiles,
// then layers.json in one rename, then removes the week folders it does not name.
func Layers(ctx context.Context, in LayerInputs, cfg LayerConfig) (*pyjson.Obj, error) {
	log := logOf(cfg.Log)
	if in.Tables.Trees == nil || in.Tables.Site == nil || in.Warper == nil || cfg.Maps == "" {
		return nil, fmt.Errorf("render: layer input is incomplete")
	}
	xs, okX := floats(in.Tables.Trees, "x")
	ys, okY := floats(in.Tables.Trees, "y")
	if !okX || !okY || len(xs) == 0 {
		return nil, fmt.Errorf("render: trees grid needs x and y")
	}
	g, err := NewGrid(ExtentBounds(xs, ys, cfg.Step), cfg.Step, Tables{Trees: in.Tables.Trees, Site: in.Tables.Site}, nil)
	if err != nil {
		return nil, err
	}
	columns := make([]string, len(WeeklyLayers))
	for i, l := range WeeklyLayers {
		columns[i] = l.Column
	}
	table, err := buildWeekTable(in.Weather, g.UniqueCells(), cfg.Weeks, 0, columns)
	if err != nil {
		return nil, err
	}
	mask := make([]bool, g.Len())
	for i := range mask {
		_, known := in.Weather.Index(g.Cell[i])
		mask[i] = known && !g.Water(i)
	}
	scales := make([][2]float64, len(WeeklyLayers))
	entries := make([]*pyjson.Obj, len(WeeklyLayers))
	for i, l := range WeeklyLayers {
		scales[i] = layerScale(l, table.vals[l.Column])
		entries[i] = pyjson.O("label", l.Label, "unit", l.Unit, "static", false,
			"low", scales[i][0], "high", scales[i][1], "weeks", []any{}, "histograms", pyjson.NewObj())
		log.Printf("  %-20s %8.1f bis %8.1f %s", l.Name, scales[i][0], scales[i][1], l.Unit)
	}
	sampler := numeric.NewCoarseSampler(table.cells, g.X, g.Y, TrainCell)
	zoom := geo.FinestZoom(float64(max(WeeklyResolution, cfg.Step)), cfg.ZoomCap, geo.ZoomBase)
	wgsBox := g.Bounds.WGSBox()
	tops := make([]float64, len(WeeklyLayers))
	for i := range tops {
		tops[i] = 1.0
	}
	for w, week := range table.weeks {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		key := week.Key()
		bands := make([][]float32, len(WeeklyLayers))
		roots := make([]string, len(WeeklyLayers))
		for i, l := range WeeklyLayers {
			vals, err := sampler.Sample(table.column(l.Column, w))
			if err != nil {
				return nil, err
			}
			field := maskedField(g, vals, mask)
			h, err := hist.ComputeFloat32(field, scales[i][0], scales[i][1])
			if err != nil {
				return nil, fmt.Errorf("render: layer %s: %w", l.Name, err)
			}
			if h != nil {
				hs, _ := entries[i].Get("histograms")
				hs.(*pyjson.Obj).Set(key, h)
			}
			ws, _ := entries[i].Get("weeks")
			entries[i].Set("weeks", append(ws.([]any), key))
			bands[i] = scaleBand(field, scales[i][0], scales[i][1])
			roots[i] = filepath.Join(cfg.Maps, "layers_kacheln", l.Name, key)
		}
		b, s := g.Bounds, float64(g.Step)
		raster := tiles.Raster{Bands: bands, NX: g.NX, NY: g.NY, EPSG: 3035,
			GeoTransform: [6]float64{float64(b.X0), s, 0, float64(b.Y1), 0, -s}}
		written, err := tiles.RenderFieldTo(in.Warper, raster, roots, tops, zoom, geo.ZoomBase, wgsBox)
		if err != nil {
			return nil, err
		}
		if w == 0 {
			for i := range entries {
				entries[i].Set("have", geo.HaveList(written[i].Filled))
			}
		}
		log.Printf("  %s: %d Ebenen", key, len(WeeklyLayers))
	}
	path := filepath.Join(cfg.Maps, LayersFile)
	old, err := readLayers(path)
	if err != nil {
		return nil, err
	}
	layers := staticEntries(layerEntries(old))
	for i, l := range WeeklyLayers {
		layers.Set(l.Name, entries[i].Set("tiles", "layers_kacheln/"+l.Name).Set("zooms", []int{geo.ZoomBase, zoom}))
	}
	meta := pyjson.O("bounds", [][]float64{{wgsBox[1], wgsBox[0]}, {wgsBox[3], wgsBox[2]}}, "layers", layers)
	data := pyjson.MarshalManifest(meta)
	if err := pyjson.WriteFileAtomic(path, data); err != nil {
		return nil, err
	}
	return meta, cleanLayers(cfg.Maps, data)
}

// layerScale is the colour scale of one layer over all rendered weeks: a fixed
// range, or the 1st and 99th percentile rounded to one decimal. The anomaly is
// symmetric around 0; the other rain layers start at 0.
func layerScale(l WeeklyLayer, vals []float32) [2]float64 {
	if r, ok := FixedRange[l.Name]; ok {
		return r
	}
	low, high := numeric.NanPercentile(vals, 1), numeric.NanPercentile(vals, 99)
	switch {
	case l.Name == "regen_anomalie":
		high = max(math.Abs(low), math.Abs(high))
		low = -high
	case len(l.Column) >= 2 && l.Column[:2] == "pr":
		low = 0
	}
	return [2]float64{pyjson.Round(low, 1), pyjson.Round(high, 1)}
}

// maskedField places the sampled values by (gy, gx), NaN where the mask is off, as to_field.
func maskedField(g *Grid, vals []float32, mask []bool) []float32 {
	out := make([]float32, len(vals))
	for i, v := range vals {
		out[i] = nan32
		if mask[i] {
			out[i] = v
		}
	}
	return place(g, out, nan32)
}

// scaleBand maps a field into 0..1 in float32, as write_fields; NaN stays NaN.
func scaleBand(field []float32, low, high float64) []float32 {
	lo, width := float32(low), float32(max(high-low, 1e-9))
	out := make([]float32, len(field))
	for i, v := range field {
		out[i] = nan32
		if finite32(v) {
			out[i] = min(max((v-lo)/width, 0), 1)
		}
	}
	return out
}

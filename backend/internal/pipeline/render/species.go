package render

import (
	"context"
	"fmt"
	"math"
	"path/filepath"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/horizons"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/activity"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/visits"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/tiles"
)

// Species draws the weekly map of one species as tiles.
// It writes the week tiles, then <Maps>/<Slug>.json in one rename, then removes the
// week folders that the manifest does not name. It returns the manifest.
func Species(ctx context.Context, in Inputs, cfg Config) (*pyjson.Obj, error) {
	log := logOf(cfg.Log)
	b := in.Bundle
	if b == nil || len(b.Horizons) == 0 || in.Warper == nil || cfg.Slug == "" || cfg.Maps == "" {
		return nil, fmt.Errorf("render: species input is incomplete")
	}
	if !safeName(cfg.Slug) {
		return nil, fmt.Errorf("render: slug %q is not a plain name", cfg.Slug)
	}
	g, err := NewGrid(RegionBounds(cfg.Region, cfg.Step), cfg.Step, in.Tables, ScaleColumns(b))
	if err != nil {
		return nil, err
	}
	if g.Forest == nil || in.Tables.Scales == nil {
		return nil, fmt.Errorf("render: the map needs forest_fraction and the tree scales")
	}
	avail := b.HorizonKeys()
	forecast := cfg.Forecast
	if forecast < 0 {
		last := in.Weather.LastObserved()
		limit := cfg.SharedHorizon
		if limit == 0 {
			limit = slices.Max(avail)
		}
		forecast = horizons.ForecastWeeks(cfg.Today, &last, limit, horizons.Lead)
	}
	features := featureUnion(b)
	wnames := weatherNames(features)
	table, err := buildWeekTable(in.Weather, g.UniqueCells(), cfg.Weeks, forecast, wnames)
	if err != nil {
		return nil, err
	}
	var observedLast *calendar.Week
	if forecast > 0 {
		last := in.Weather.LastObserved()
		observedLast = &last
	}
	fields := in.Activity
	if fields == nil {
		training := occ.TrainingSet(in.Records, visits.MinYear, visits.MaxUncertainty)
		if fields, err = activity.New(training, b.Species, activity.BlockM); err != nil {
			return nil, err
		}
	}
	fixed := fixedColumns(g, b.Prior)
	bare := bareMask(g, table.cells, cfg.MinForest)
	log.Printf("%s: %v, Horizonte %v, %d Spalten, Prognose %d Wochen", cfg.Slug, b.Species, avail, len(features), forecast)

	consts := map[string]float32{"n_species": float32(cfg.ReferenceSpecies), "n_records": float32(cfg.ReferenceRecords)}
	plans := map[int]plan{}
	weekHorizon := make([]int, len(table.weeks))
	for i, w := range table.weeks {
		h, err := horizons.HorizonFor(w, observedLast, avail)
		if err != nil {
			return nil, err
		}
		weekHorizon[i] = h
		if _, ok := plans[h]; !ok {
			plans[h] = newPlan(h, b.Horizons[h], fixed, wnames, consts, log)
		}
	}
	r := speciesRun{
		cfg: cfg, in: in, grid: g, table: table, fields: fields, fixed: fixed, bare: bare,
		chunks: newChunks(g, table.cells, max(cfg.ChunkRows, 1)), top: b.Top(),
		zoom: geo.FinestZoom(float64(cfg.Step), cfg.ZoomCap, geo.ZoomBase), wgsBox: g.Bounds.WGSBox(),
	}
	var entries []any
	var filled [][]geo.TileID
	var merc *[4]float64
	for i, w := range table.weeks {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		field, err := r.field(plans[weekHorizon[i]], i, w)
		if err != nil {
			return nil, fmt.Errorf("render: %s week %s: %w", cfg.Slug, w.Key(), err)
		}
		log.Printf("  %d-W%02d  mean %.3f max %.3f", w.Year, w.Week, nanMean(field), nanMax(field))
		raster := r.raster(field)
		if merc == nil {
			box, err := tiles.AutoBounds3857(in.Warper, raster)
			if err != nil {
				return nil, err
			}
			merc = &box
		}
		rel := cfg.Slug + "_kacheln/" + w.Key()
		written, err := tiles.RenderFieldTo(in.Warper, raster, []string{filepath.Join(cfg.Maps, filepath.FromSlash(rel))},
			[]float64{r.top}, r.zoom, geo.ZoomBase, r.wgsBox)
		if err != nil {
			return nil, err
		}
		filled = append(filled, written[0].Filled)
		entry, err := weekEntry(w.Year, w.Week, weekHorizon[i] > 0, field, r.top, rel)
		if err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	if merc == nil {
		return nil, fmt.Errorf("render: %s has no week to draw", cfg.Slug)
	}
	meta := pyjson.O("name", cfg.Slug, "species", b.Species, "top", r.top,
		"bounds", latLonBounds(*merc), "weeks", entries,
		"tiles", tiles.SpeciesTiles(filled, geo.ZoomBase, r.zoom))
	if err := pyjson.WriteManifest(filepath.Join(cfg.Maps, cfg.Slug+".json"), meta); err != nil {
		return nil, err
	}
	if err := cleanSpecies(cfg.Maps, cfg.Slug, weekKeys(table.weeks)); err != nil {
		return nil, err
	}
	return meta, nil
}

// speciesRun holds what each week of one species map shares.
type speciesRun struct {
	cfg    Config
	in     Inputs
	grid   *Grid
	table  *weekTable
	fields *activity.Fields
	fixed  map[string][]float32
	bare   []bool
	chunks []chunk
	top    float64
	zoom   int
	wgsBox [4]float64
}

// field predicts one week chunk by chunk, masks the bare cells, places the
// values by (gy, gx) and smooths the raster.
func (r speciesRun) field(p plan, w int, week calendar.Week) ([]float64, error) {
	prob := make([]float64, r.grid.Len())
	in := weekInput{week: week, w: w, table: r.table, fields: r.fields}
	for _, c := range r.chunks {
		part, err := p.predict(r.grid, c, r.fixed, in, r.cfg.Threads)
		if err != nil {
			return nil, err
		}
		copy(prob[c.lo:c.hi], part)
	}
	for i, bare := range r.bare {
		if bare {
			prob[i] = math.NaN()
		}
	}
	field := place(r.grid, prob, math.NaN())
	return Smooth(field, r.grid.NY, r.grid.NX, r.cfg.Smooth, r.cfg.Spill), nil
}

// raster is the field as the float32 GeoTIFF of schreibe_woche: origin (x0, y1), step metres, EPSG:3035.
func (r speciesRun) raster(field []float64) tiles.Raster {
	band := make([]float32, len(field))
	for i, v := range field {
		band[i] = float32(v)
	}
	b, s := r.grid.Bounds, float64(r.grid.Step)
	return tiles.Raster{
		Bands: [][]float32{band}, NX: r.grid.NX, NY: r.grid.NY, EPSG: 3035,
		GeoTransform: [6]float64{float64(b.X0), s, 0, float64(b.Y1), 0, -s},
	}
}

// featureUnion returns the sorted union of the features of each horizon.
func featureUnion(b *bundle.Bundle) []string {
	var out []string
	for _, hz := range b.Horizons {
		out = append(out, hz.Features...)
	}
	slices.Sort(out)
	return slices.Compact(out)
}

// fixedColumns returns the grid columns that a model may read, as float32:
// the position, the masks, the tree scales and the prior of the cell and the block.
// A cell or block without training visits has n = 0 and no rate.
func fixedColumns(g *Grid, prior bundle.Prior) map[string][]float32 {
	n := g.Len()
	out := map[string][]float32{}
	conv := func(f func(i int) float64) []float32 {
		col := make([]float32, n)
		for i := range col {
			col[i] = float32(f(i))
		}
		return col
	}
	out["x"] = conv(func(i int) float64 { return g.X[i] })
	out["y"] = conv(func(i int) float64 { return g.Y[i] })
	out["gx"] = conv(func(i int) float64 { return float64(g.GX[i]) })
	out["gy"] = conv(func(i int) float64 { return float64(g.GY[i]) })
	out["forest_mask"] = conv(func(i int) float64 { return g.Forest[i] })
	if g.Soil != nil {
		out["soil_phh2o_0_5cm"] = g.Soil
	}
	for name, col := range g.Cols {
		out[name] = col
	}
	for _, p := range []struct {
		key   string
		table bundle.PriorTable
		size  float64
	}{{"cell", prior.Cell, TrainCell}, {"block", prior.Block, activity.BlockM}} {
		look := p.table.Lookup()
		rate, cnt := make([]float32, n), make([]float32, n)
		for i := range n {
			rt, c := look(geo.CellOf(g.X[i], g.Y[i], p.size).String())
			rate[i], cnt[i] = float32(rt), float32(c)
		}
		out["prior_rate_"+p.key], out["prior_n_"+p.key] = rate, cnt
	}
	return out
}

// bareMask marks the cells that stay empty: too little forest, no weather cell
// (abroad) or no soil value (water).
func bareMask(g *Grid, weatherCells []geo.CellKey, minForest float64) []bool {
	known := make(map[geo.CellKey]bool, len(weatherCells))
	for _, c := range weatherCells {
		known[c] = true
	}
	out := make([]bool, g.Len())
	for i := range out {
		low := g.Forest[i] < minForest
		if g.ForestF32 {
			low = float32(g.Forest[i]) < float32(minForest)
		}
		out[i] = low || !known[g.Cell[i]] || g.Water(i)
	}
	return out
}

func weekKeys(weeks []calendar.Week) []string {
	out := make([]string, len(weeks))
	for i, w := range weeks {
		out[i] = w.Key()
	}
	return out
}

// latLonBounds converts an EPSG:3857 extent to [[south, west], [north, east]] in degrees.
func latLonBounds(merc [4]float64) [][]float64 {
	w, s := invMercator(merc[0], merc[1])
	e, n := invMercator(merc[2], merc[3])
	return [][]float64{{s, w}, {n, e}}
}

// invMercator is the spherical inverse of EPSG:3857 in the arithmetic that
// reproduces pyproj to the last bit: a product with 1/a and asin(tanh(y)).
func invMercator(x, y float64) (lon, lat float64) {
	const ra = 1 / 6378137.0
	const degToRad = 0.017453292519943296
	return x * ra / degToRad, math.Asin(math.Tanh(y*ra)) / degToRad
}

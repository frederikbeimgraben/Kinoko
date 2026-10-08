package derive

import (
	"context"
	"path/filepath"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// Limits of the raster checks (plan section 7.1). The coverage is measured
// against the grid box, which is a little larger than Germany; 0.9 of it
// equals about 95 % of the extent of Germany.
const (
	MinCoverage     = 0.9
	TreeMaxPixelM   = 10.5
	DEMMaxPixelM    = 100
	DEMLow          = -500
	DEMHigh         = 5000
	SoilMaxPixelM   = 300
	OtherClassShare = 0.01
)

// treeValues are the class numbers that the tree map can hold.
var treeValues = []int{0, 2, 3, 4, 5, 6, 8, 9, 10, 14, 16, 17}

func allFiles(string) bool { return true }

// openUpload opens the mosaic of the rasters of a version.
func openUpload(v *sources.Version, keep func(string) bool) (string, []string, error) {
	files, err := RasterFiles(v.Original(), keep)
	if err != nil {
		return "", nil, sources.Fail("unreadable", "%v", err)
	}
	mosaic, err := Mosaic(files, filepath.Join(v.Dir, "work"), "mosaic.vrt")
	if err != nil {
		return "", nil, sources.Fail("unreadable", "%v", err)
	}
	return mosaic, files, nil
}

// inspectUpload checks the common rules: one band, a data type of the list,
// the pixel size and the coverage of the grid.
func inspectUpload(path string, g Grid, dtypes []string, maxPixel float64) (RasterReport, error) {
	ds, err := openRaster(path)
	if err != nil {
		return RasterReport{}, sources.Fail("unreadable", "GDAL cannot open the raster: %v", err)
	}
	defer func() { _ = ds.Close() }()
	r, err := Inspect(ds, g)
	switch {
	case err != nil:
		return r, sources.Fail("crs", "%v", err)
	case r.Bands != 1:
		return r, sources.Fail("bands", "the raster has %d bands, expected 1", r.Bands)
	case !slices.Contains(dtypes, r.DType):
		return r, sources.Fail("dtype", "the data type is %s, expected %s", r.DType, strings.Join(dtypes, " or "))
	case r.PixelM > maxPixel:
		return r, sources.Fail("pixel", "the pixel is %.1f m, expected at most %.1f m", r.PixelM, maxPixel)
	case r.Coverage < MinCoverage:
		return r, sources.Fail("coverage", "the raster covers %.0f %% of the grid, expected at least %.0f %%",
			r.Coverage*100, MinCoverage*100)
	}
	return r, nil
}

// TreeMap processes the tree species map: the trees grid, the tree scales
// and the fine tree layers.
type TreeMap struct{ Config }

// Validate checks the band, the pixel, the coverage and the class values.
func (p TreeMap) Validate(ctx context.Context, v *sources.Version) (map[string]any, error) {
	mosaic, _, err := openUpload(v, allFiles)
	if err != nil {
		return nil, err
	}
	r, err := inspectUpload(mosaic, p.grid(), []string{"Byte"}, TreeMaxPixelM)
	if err != nil {
		return nil, err
	}
	ds, err := openRaster(mosaic)
	if err != nil {
		return nil, err
	}
	defer func() { _ = ds.Close() }()
	counts, err := ClassHistogram(ds)
	if err != nil {
		return nil, err
	}
	total, other := 0, 0
	for value, n := range counts {
		total += n
		if !slices.Contains(treeValues, value) {
			other += n
		}
	}
	if total == 0 || float64(other) >= OtherClassShare*float64(total) {
		return nil, sources.Fail("classes", "%d of %d sampled points hold no class of the map", other, total)
	}
	meta := r.Meta()
	meta["classesSeen"] = fn.SortedKeys(counts)
	return meta, ctx.Err()
}

// Derive counts the trees grid, smooths the tree scales and renders the
// fine tree layers when an outline of Germany is active.
func (p TreeMap) Derive(ctx context.Context, v *sources.Version) ([]sources.Artifact, error) {
	mosaic, _, err := openUpload(v, allFiles)
	if err != nil {
		return nil, err
	}
	g, out := p.grid(), v.DerivedDir()
	counts, err := TileTrees(ctx, mosaic, g, TreeOptions{Tile: p.TreeTile, Progress: func(done, total int) {
		if done%10 == 0 || done == total {
			v.Logf("tiles %d/%d", done, total)
		}
	}})
	if err != nil {
		return nil, err
	}
	grid := counts.Table()
	schema := TreesGridSchema()
	if _, err := writeTable(out, ArtTreesGrid, grid, schema); err != nil {
		return nil, err
	}
	scales, scaleSchema, err := TreeScales(grid, fn.Map(schema, func(c pio.ColumnSpec) string { return c.Name }), g.Step)
	if err != nil {
		return nil, err
	}
	if _, err := writeTable(out, ArtTreeScales, scales, scaleSchema); err != nil {
		return nil, err
	}
	var artifacts []sources.Artifact
	for _, a := range []struct {
		kind sources.Kind
		name string
	}{{sources.KindTreesGrid, ArtTreesGrid}, {sources.KindTreeScales, ArtTreeScales}} {
		art, err := p.promote(ctx, v, a.kind, a.name, filepath.Join(out, a.name+".parquet"))
		if err != nil {
			return nil, err
		}
		artifacts = append(artifacts, art)
	}
	outline, err := p.optionalPath(sources.KindGermanyOutline, "outline")
	if err != nil {
		return nil, err
	}
	if outline == "" {
		v.Logf("no active germany-outline: the fine tree layers are left out")
		return artifacts, nil
	}
	fine, err := p.renderFine(ctx, v, FineInputs{Trees: mosaic, Outline: outline})
	return append(artifacts, fine...), err
}

// DEM processes the elevation model: the terrain rasters, the terrain
// columns of the site grid and the fine terrain layers.
type DEM struct{ Config }

// Validate checks the band, the pixel, the coverage and the value range.
func (p DEM) Validate(ctx context.Context, v *sources.Version) (map[string]any, error) {
	mosaic, files, err := openUpload(v, allFiles)
	if err != nil {
		return nil, err
	}
	r, err := inspectUpload(mosaic, p.grid(), []string{"Float32", "Int16"}, DEMMaxPixelM)
	if err != nil {
		return nil, err
	}
	ds, err := openRaster(mosaic)
	if err != nil {
		return nil, err
	}
	defer func() { _ = ds.Close() }()
	lo, hi, ok, err := ValueRange(ds)
	if err != nil {
		return nil, err
	}
	if !ok || lo < DEMLow || hi > DEMHigh {
		return nil, sources.Fail("values", "the heights run from %.0f to %.0f m, expected %d to %d m", lo, hi, DEMLow, DEMHigh)
	}
	meta := r.Meta()
	meta["files"], meta["range"] = len(files), []float64{lo, hi}
	return meta, ctx.Err()
}

// Derive makes the terrain rasters, the terrain columns and the fine
// terrain layers. It joins the site grid when SoilGrids are active.
func (p DEM) Derive(ctx context.Context, v *sources.Version) ([]sources.Artifact, error) {
	_, files, err := openUpload(v, allFiles)
	if err != nil {
		return nil, err
	}
	g, out := p.grid(), v.DerivedDir()
	f, err := BuildDEM(ctx, files, g, out)
	if err != nil {
		return nil, err
	}
	dem, err := DEMColumns(ctx, f, g)
	if err != nil {
		return nil, err
	}
	if err := writeColumns(out, ArtSiteDEM, g, dem); err != nil {
		return nil, err
	}
	rel := []string{"dem90_3035.tif", "slope90.tif", "aspect90.tif", "northness90.tif", "eastness90.tif", ArtSiteDEM + ".parquet"}
	soilPart, err := p.optionalPath(sources.KindSoilGrids, ArtSiteSoil)
	if err != nil {
		return nil, err
	}
	if soilPart != "" {
		soil, err := readColumns(soilPart, g)
		if err != nil {
			return nil, err
		}
		if _, err := writeSite(out, g, dem, soil); err != nil {
			return nil, err
		}
	}
	artifacts, err := artifactsOf(out, rel...)
	if err != nil {
		return nil, err
	}
	if soilPart != "" {
		site, err := p.promote(ctx, v, sources.KindSiteGrid, ArtSite, filepath.Join(out, ArtSite+".parquet"))
		if err != nil {
			return nil, err
		}
		artifacts = append(artifacts, site)
	}
	fine, err := p.renderFine(ctx, v, FineInputs{DEM: f})
	return append(artifacts, fine...), err
}

// SoilGrids processes the SoilGrids rasters: the soil columns of the site
// grid with the water mask, and the fine soil layers.
type SoilGrids struct{ Config }

func soilFile(base string) bool { return SoilPattern.MatchString(base) }

// Validate checks the names, the required files, the data type and the coverage.
func (p SoilGrids) Validate(ctx context.Context, v *sources.Version) (map[string]any, error) {
	files, err := RasterFiles(v.Original(), soilFile)
	if err != nil {
		return nil, sources.Fail("missing_files", "%v", err)
	}
	stems := fn.Map(files, SoilStem)
	if missing := fn.Filter(SoilRequired, func(s string) bool { return !slices.Contains(stems, s) }); len(missing) > 0 {
		return nil, sources.Fail("missing_files", "the archive has no %s", strings.Join(missing, ", "))
	}
	reports := map[string]any{}
	for _, f := range files {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		r, err := inspectUpload(f, p.grid(), []string{"Int16"}, SoilMaxPixelM)
		if err != nil {
			return nil, err
		}
		reports[SoilStem(f)] = r.Meta()
	}
	return map[string]any{"files": slices.Sorted(slices.Values(stems)), "rasters": reports}, nil
}

// Derive makes the soil columns and the site grid, joined with the terrain
// columns when a DEM is active, and the fine soil layers.
func (p SoilGrids) Derive(ctx context.Context, v *sources.Version) ([]sources.Artifact, error) {
	files, err := RasterFiles(v.Original(), soilFile)
	if err != nil {
		return nil, err
	}
	g, out := p.grid(), v.DerivedDir()
	soil, err := SoilColumns(ctx, files, g)
	if err != nil {
		return nil, err
	}
	if err := writeColumns(out, ArtSiteSoil, g, soil); err != nil {
		return nil, err
	}
	var dem Columns
	demPart, err := p.optionalPath(sources.KindDEM, ArtSiteDEM)
	if err != nil {
		return nil, err
	}
	if demPart != "" {
		if dem, err = readColumns(demPart, g); err != nil {
			return nil, err
		}
	} else {
		v.Logf("no active dem: the site grid has the soil columns only")
	}
	if _, err := writeSite(out, g, dem, soil); err != nil {
		return nil, err
	}
	artifacts, err := artifactsOf(out, ArtSiteSoil+".parquet")
	if err != nil {
		return nil, err
	}
	site, err := p.promote(ctx, v, sources.KindSiteGrid, ArtSite, filepath.Join(out, ArtSite+".parquet"))
	if err != nil {
		return nil, err
	}
	artifacts = append(artifacts, site)
	fine, err := p.renderFine(ctx, v, FineInputs{Soil: fn.ToMap(files, func(f string) (string, string) { return SoilStem(f), f })})
	return append(artifacts, fine...), err
}

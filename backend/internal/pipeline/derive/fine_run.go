package derive

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"slices"

	"github.com/airbusgeo/godal"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/hist"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/tiles"
)

// LayersFile and TilesFolder are the names of the static layer manifest and
// of the tile folder, as in the static-layers upload.
const (
	LayersFile  = "layers.json"
	TilesFolder = "layers_kacheln"
)

// FineInputs are the source files of the fine layers. Empty paths leave the
// layers of that source out. Outline is the Germany outline in any CRS.
type FineInputs struct {
	Trees   string
	Outline string
	DEM     DEMFiles
	Soil    map[string]string // SoilGrids stem, e.g. "phh2o_0-5cm", to file
}

// FineOptions steers RenderFine. Zero values take the defaults of
// fine_layers.py: box Germany, zoom cap 13, 16 tiles per block, haveZoom 10.
type FineOptions struct {
	Box        [4]float64
	Layers     []string
	ZoomCap    int
	BlockTiles int
	HaveZoom   int
	Log        func(format string, args ...any)
}

func (o FineOptions) withDefaults() FineOptions {
	if o.Box == ([4]float64{}) {
		o.Box = Germany
	}
	if o.ZoomCap == 0 {
		o.ZoomCap = geo.ZoomCap
	}
	if o.BlockTiles == 0 {
		o.BlockTiles = 16
	}
	if o.HaveZoom == 0 {
		o.HaveZoom = tiles.FineHaveZoom
	}
	if o.Log == nil {
		o.Log = func(string, ...any) {}
	}
	return o
}

// Available gives the fine layers whose source is in the inputs.
func (in FineInputs) Available() []FineLayer {
	return slices.DeleteFunc(slices.Clone(FineLayers), func(l FineLayer) bool { return in.path(l) == "" })
}

func (in FineInputs) path(l FineLayer) string {
	switch l.Source {
	case SourceTrees:
		if in.Outline == "" {
			return ""
		}
		return in.Trees
	case SourceDEM:
		return in.DEM.DEM
	case SourceSlope:
		return in.DEM.Slope
	case SourceNorthness:
		return in.DEM.Northness
	default:
		return in.Soil[l.Soil]
	}
}

// RenderFine renders the fine layers into out/layers_kacheln/<name> and
// writes their entries to out/layers.json, as fine_layers.main. work holds
// the weight tiles. It gives the layers that it rendered.
func RenderFine(ctx context.Context, in FineInputs, out, work string, opt FineOptions) ([]FineLayer, error) {
	opt = opt.withDefaults()
	layers := in.Available()
	if len(opt.Layers) > 0 {
		layers = slices.DeleteFunc(layers, func(l FineLayer) bool { return !slices.Contains(opt.Layers, l.Name) })
	}
	if len(layers) == 0 {
		return nil, nil
	}
	r, err := newFineRun(in, out, work, layers, opt)
	if err != nil {
		return nil, err
	}
	defer r.close()
	zooms := slices.Sorted(slices.Values(r.zoomSet()))
	slices.Reverse(zooms)
	for _, zoom := range slices.Compact(zooms) {
		if err := r.renderZoom(ctx, zoom); err != nil {
			return nil, err
		}
	}
	for _, l := range layers {
		coarse, err := tiles.Coarsen(r.stores[l.Name], r.zooms[l.Name], geo.ZoomBase)
		if err != nil {
			return nil, err
		}
		r.filled[l.Name] = append(r.filled[l.Name], coarse...)
		opt.Log("%s: %d tiles", l.Name, len(r.filled[l.Name]))
	}
	manifest, err := FineManifest(layers, r.filled, r.zooms, opt.HaveZoom, r.stores)
	if err != nil {
		return nil, err
	}
	return layers, pyjson.WriteManifest(filepath.Join(out, LayersFile), manifest)
}

type fineRun struct {
	in      FineInputs
	opt     FineOptions
	layers  []FineLayer
	zooms   map[string]int
	stores  map[string]tiles.DirStore
	filled  map[string][]geo.TileID
	trees   *treeMap
	outline *godal.Dataset
}

func newFineRun(in FineInputs, out, work string, layers []FineLayer, opt FineOptions) (*fineRun, error) {
	r := &fineRun{in: in, opt: opt, layers: layers, zooms: map[string]int{},
		stores: map[string]tiles.DirStore{}, filled: map[string][]geo.TileID{}}
	for _, l := range layers {
		r.zooms[l.Name] = l.Zoom(opt.ZoomCap)
		r.stores[l.Name] = tiles.DirStore{
			Root:    filepath.Join(out, TilesFolder, l.Name),
			Weights: filepath.Join(work, "gewicht", l.Name),
		}
		for _, dir := range []string{r.stores[l.Name].Root, r.stores[l.Name].Weights} {
			if err := os.RemoveAll(dir); err != nil {
				return nil, err
			}
		}
	}
	if slices.ContainsFunc(layers, func(l FineLayer) bool { return l.Source == SourceTrees }) {
		if err := r.openTrees(work); err != nil {
			r.close()
			return nil, err
		}
	}
	return r, nil
}

// openTrees opens the tree map and the outline in EPSG:32632. gdal_rasterize
// does not reproject, so the outline is reprojected first, as build_outline.
func (r *fineRun) openTrees(work string) error {
	src, err := openRaster(r.in.Trees)
	if err != nil {
		return err
	}
	gt, err := src.GeoTransform()
	if err != nil {
		_ = src.Close()
		return err
	}
	nx, ny := size(src)
	info := RasterBounds(gt, nx, ny)
	r.trees = &treeMap{ds: src, utm: epsgOfDataset(src) == UTMCode, bounds: info}
	if !r.trees.utm {
		r.trees.bounds = [4]float64{-1e12, -1e12, 1e12, 1e12}
	}
	vec, err := godal.Open(r.in.Outline, godal.VectorOnly())
	if err != nil {
		return fmt.Errorf("derive: open outline: %w", err)
	}
	defer func() { _ = vec.Close() }()
	if err := os.MkdirAll(work, 0o755); err != nil {
		return err
	}
	target := filepath.Join(work, "outline_32632.geojson")
	_ = os.Remove(target)
	r.outline, err = vec.VectorTranslate(target, []string{"-f", "GeoJSON", "-t_srs", fmt.Sprintf("EPSG:%d", UTMCode)}, quiet)
	if err != nil {
		return fmt.Errorf("derive: reproject outline: %w", err)
	}
	return nil
}

func (r *fineRun) close() {
	if r.trees != nil {
		_ = r.trees.ds.Close()
	}
	if r.outline != nil {
		_ = r.outline.Close()
	}
}

func (r *fineRun) zoomSet() []int {
	out := make([]int, 0, len(r.layers))
	for _, l := range r.layers {
		out = append(out, r.zooms[l.Name])
	}
	return out
}

// renderZoom runs the block loop of one zoom over the layers of that zoom.
func (r *fineRun) renderZoom(ctx context.Context, zoom int) error {
	group := slices.DeleteFunc(slices.Clone(r.layers), func(l FineLayer) bool { return r.zooms[l.Name] != zoom })
	trees := group[0].Source == SourceTrees
	side := r.opt.BlockTiles * tiles.TileSize
	blocks := tiles.BlockGrid(r.opt.Box, zoom, r.opt.BlockTiles)
	r.opt.Log("zoom %d..%d, %d blocks", geo.ZoomBase, zoom, len(blocks))
	paths := map[string]string{}
	for _, l := range group {
		paths[l.Name] = r.in.path(l)
	}
	for i, b := range blocks {
		if err := ctx.Err(); err != nil {
			return err
		}
		merc := tiles.BlockBox(b[0], b[1], zoom, r.opt.BlockTiles)
		var fields *blockFields
		var err error
		if trees {
			fields, err = treeBlock(*r.trees, r.outline, merc, group)
		} else {
			fields, err = rasterBlock(paths, merc, side, group)
		}
		if err != nil {
			return err
		}
		if fields == nil {
			continue
		}
		for _, l := range group {
			ids, err := cutLayer(fields, l, r.stores[l.Name], merc, side, zoom, b[0]*r.opt.BlockTiles, b[1]*r.opt.BlockTiles)
			if err != nil {
				return err
			}
			r.filled[l.Name] = append(r.filled[l.Name], ids...)
		}
		r.opt.Log("  [%d/%d] %d_%d_%d: data", i+1, len(blocks), zoom, b[0], b[1])
	}
	return nil
}

// FineManifest gives {"layers": {...}} with one entry per layer, as
// update_manifest on an empty manifest. The histogram reads the tiles of
// zoom ZoomBase+2 back from the store.
func FineManifest(layers []FineLayer, filled map[string][]geo.TileID, zooms map[string]int,
	haveZoom int, stores map[string]tiles.DirStore) (*pyjson.Obj, error) {
	entries := pyjson.NewObj()
	for _, l := range layers {
		e := pyjson.O("label", l.Label, "note", l.Note, "unit", l.Unit, "static", true,
			"low", l.Low, "high", l.High, "tiles", TilesFolder+"/"+l.Name)
		e = tiles.SetFineCoverage(e, filled[l.Name], zooms[l.Name], haveZoom, l.OfflineZoom)
		h, err := layerHistogram(l, filled[l.Name], haveZoom, stores[l.Name])
		if err != nil {
			return nil, err
		}
		if h != nil {
			e.Set("histogram", h)
		}
		entries.Set(l.Name, e)
	}
	return pyjson.O("layers", entries), nil
}

func layerHistogram(l FineLayer, filled []geo.TileID, haveZoom int, store tiles.DirStore) (*hist.Histogram, error) {
	zoom := geo.ZoomBase + 2
	if zoom > haveZoom {
		return nil, nil
	}
	var codes [][]uint8
	for _, id := range filled {
		if id.Z != zoom {
			continue
		}
		code, err := tiles.ReadTile(store.Root, id)
		if err != nil {
			return nil, err
		}
		if code != nil {
			codes = append(codes, code)
		}
	}
	values := LayerValues(codes, l.Low, l.High)
	if len(values) == 0 {
		return nil, nil
	}
	return hist.ComputeFloat32(values, l.Low, l.High)
}

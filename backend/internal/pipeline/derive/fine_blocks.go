package derive

import (
	"fmt"
	"math"
	"slices"

	"github.com/airbusgeo/godal"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/tiles"
)

// UTMCode is the EPSG code of the tree map and of the inland mask (SOURCE_CRS).
const UTMCode = 32632

// utmMargin is the margin of the UTM box of a tree block in metres.
const utmMargin = 200.0

// toUTM projects EPSG:3857 points to EPSG:32632 with PROJ.
func toUTM(xs, ys []float64) error {
	registerGDAL()
	merc, err := godal.NewSpatialRefFromEPSG(3857)
	if err != nil {
		return err
	}
	defer merc.Close()
	utm, err := godal.NewSpatialRefFromEPSG(UTMCode)
	if err != nil {
		return err
	}
	defer utm.Close()
	t, err := godal.NewTransform(merc, utm)
	if err != nil {
		return err
	}
	defer t.Close()
	return t.TransformEx(xs, ys, nil, nil)
}

// UTMBox gives the EPSG:32632 box that covers a EPSG:3857 box, with a
// margin, as utm_box: the four corners, x first.
func UTMBox(merc [4]float64, margin float64) ([4]float64, error) {
	xs := []float64{merc[0], merc[0], merc[2], merc[2]}
	ys := []float64{merc[1], merc[3], merc[1], merc[3]}
	if err := toUTM(xs, ys); err != nil {
		return [4]float64{}, err
	}
	return [4]float64{slices.Min(xs) - margin, slices.Min(ys) - margin, slices.Max(xs) + margin, slices.Max(ys) + margin}, nil
}

// treeMap is the open tree species map.
type treeMap struct {
	ds     *godal.Dataset
	utm    bool
	bounds [4]float64
}

// cut gives the class numbers of the map in a UTM box, or nil when the box
// misses the map. A map in EPSG:32632 is cut on its own pixel grid, as the
// WCS GetCoverage of tree_species.fetch. Another CRS is warped to 10 m.
func (m treeMap) cut(box [4]float64) (*godal.Dataset, error) {
	if box[0] >= m.bounds[2] || box[2] <= m.bounds[0] || box[1] >= m.bounds[3] || box[3] <= m.bounds[1] {
		return nil, nil
	}
	f := func(v float64) string { return fmt.Sprintf("%.0f", v) }
	if m.utm {
		out, err := m.ds.Translate("", []string{"-projwin", f(box[0]), f(box[3]), f(box[2]), f(box[1])}, godal.Memory, quiet)
		if err != nil {
			return nil, fmt.Errorf("derive: cut tree map: %w", err)
		}
		return out, nil
	}
	px := itoa(TreePixel)
	return warpMem(m.ds, []string{"-t_srs", fmt.Sprintf("EPSG:%d", UTMCode),
		"-te", f(box[0]), f(box[1]), f(box[2]), f(box[3]), "-tr", px, px, "-r", "near"})
}

// inlandMask burns the outline onto the box with the pixel of the class
// block, as rasterize_inland. outline must be in EPSG:32632.
func inlandMask(outline *godal.Dataset, box [4]float64, pixel float64) ([]uint8, int, int, error) {
	width := max(1, int(math.RoundToEven((box[2]-box[0])/pixel)))
	height := max(1, int(math.RoundToEven((box[3]-box[1])/pixel)))
	f := func(v float64) string { return fmt.Sprintf("%.3f", v) }
	ds, err := outline.Rasterize("", []string{"-burn", "1", "-init", "0", "-ot", "Byte",
		"-a_srs", fmt.Sprintf("EPSG:%d", UTMCode), "-te", f(box[0]), f(box[1]), f(box[2]), f(box[3]),
		"-ts", itoa(width), itoa(height)}, godal.Memory, quiet)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("derive: rasterize outline: %w", err)
	}
	defer func() { _ = ds.Close() }()
	mask, err := readBytes(ds)
	return mask, width, height, err
}

// treeBlock gives the fields of the tree layers on one block, as tree_block,
// or nil when the block holds no forest and no inland ground.
func treeBlock(m treeMap, outline *godal.Dataset, merc [4]float64, layers []FineLayer) (*blockFields, error) {
	box, err := UTMBox(merc, utmMargin)
	if err != nil {
		return nil, err
	}
	cut, err := m.cut(box)
	if err != nil || cut == nil {
		return nil, err
	}
	defer func() { _ = cut.Close() }()
	classes, err := readBytes(cut)
	if err != nil {
		return nil, err
	}
	nx, ny := size(cut)
	gt, err := cut.GeoTransform()
	if err != nil {
		return nil, err
	}
	inland, w, h, err := inlandMask(outline, box, math.Abs(gt[1]))
	if err != nil {
		return nil, err
	}
	if w != nx || h != ny {
		inland = slices.Repeat([]uint8{1}, nx*ny)
	}
	if !slices.ContainsFunc(classes, func(c uint8) bool { return c > 0 }) &&
		!slices.ContainsFunc(inland, func(c uint8) bool { return c > 0 }) {
		return nil, nil
	}
	return &blockFields{nx: nx, ny: ny, gt: gt, epsg: UTMCode, field: func(l FineLayer) []float32 {
		return TreeField(classes, inland, l)
	}}, nil
}

// blockFields makes the field of each layer on one block when asked, so
// that only one float field is in memory at a time.
type blockFields struct {
	nx, ny int
	gt     [6]float64
	epsg   int
	field  func(FineLayer) []float32
}

// rasterBlock gives the fields of the file layers on one block, as
// raster_block, or nil when each field is empty.
func rasterBlock(paths map[string]string, merc [4]float64, side int, layers []FineLayer) (*blockFields, error) {
	pixel := (merc[2] - merc[0]) / float64(side)
	fields := map[string][]float32{}
	var last tiles.Raster
	for _, l := range layers {
		r, err := tiles.NewGDALWarper().Warp(tiles.File(paths[l.Name]), tiles.BlockCutSwitches(merc, pixel, l.Nodata))
		if err != nil {
			return nil, err
		}
		fields[l.Name] = ScaleField(r.Bands[0], l)
		last = r
	}
	empty := func(v []float32) bool {
		return !slices.ContainsFunc(v, func(x float32) bool { return !math.IsNaN(float64(x)) })
	}
	if len(layers) == 0 || allOf(layers, func(l FineLayer) bool { return empty(fields[l.Name]) }) {
		return nil, nil
	}
	return &blockFields{nx: last.NX, ny: last.NY, gt: last.GeoTransform, epsg: 3857,
		field: func(l FineLayer) []float32 { return fields[l.Name] }}, nil
}

func allOf[T any](items []T, ok func(T) bool) bool {
	return !slices.ContainsFunc(items, func(t T) bool { return !ok(t) })
}

// cutLayer warps the field of one layer onto the tile grid of the block and writes its tiles.
// It gives the tiles with data. It warps one band per call: with UNIFIED_SRC_NODATA=NO each band
// keeps its own nodata, and one float field fits the 1 GB limit.
func cutLayer(b *blockFields, l FineLayer, store tiles.DirStore, merc [4]float64, side, zoom, tx0, ty0 int) ([]geo.TileID, error) {
	src := tiles.Raster{Bands: [][]float32{b.field(l)}, NX: b.nx, NY: b.ny, GeoTransform: b.gt, EPSG: b.epsg}
	warped, err := tiles.NewGDALWarper().Warp(src, tiles.TileGridSwitches(merc, side, side))
	if err != nil {
		return nil, err
	}
	var out []geo.TileID
	for _, p := range tiles.Cut(geo.ToBytes(warped.Bands[0]), warped.NX, warped.NY, zoom, tx0, ty0) {
		if err := store.Put(p.ID, p.Tile); err != nil {
			return nil, err
		}
		out = append(out, p.ID)
	}
	return out, nil
}

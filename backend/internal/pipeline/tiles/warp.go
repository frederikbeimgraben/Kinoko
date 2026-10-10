package tiles

import (
	"fmt"
	"strconv"

	"github.com/airbusgeo/godal"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

// Mercator is the CRS of the tile grid.
const Mercator = "EPSG:3857"

// Warper runs gdalwarp with a list of switches and returns the result in memory.
type Warper interface {
	Warp(src Source, switches []string) (Raster, error)
}

// GDALWarper is the Warper of the GDAL library (godal), the same code as the gdalwarp tool.
type GDALWarper struct{}

// NewGDALWarper returns the GDAL Warper.
func NewGDALWarper() Warper { return GDALWarper{} }

// Warp runs the GDAL warp library into a MEM dataset.
func (GDALWarper) Warp(src Source, switches []string) (Raster, error) {
	in, err := src.open()
	if err != nil {
		return Raster{}, fmt.Errorf("tiles: open source: %w", err)
	}
	defer func() { _ = in.Close() }()
	out, err := in.Warp("", switches, godal.Memory)
	if err != nil {
		return Raster{}, fmt.Errorf("tiles: warp %v: %w", switches, err)
	}
	defer func() { _ = out.Close() }()
	return readRaster(out)
}

// The switch lists below have no "-q", "-overwrite" and file names: these
// only steer the command-line tool.

func extent(box [4]float64) []string {
	out := make([]string, 4)
	for i, v := range box {
		out[i] = fmt.Sprintf("%.6f", v)
	}
	return out
}

// TileGridSwitches hits the tile grid of box exactly with w×h points. Each band keeps its own mask.
func TileGridSwitches(box [4]float64, w, h int) []string {
	s := []string{"-t_srs", Mercator, "-te"}
	s = append(s, extent(box)...)
	return append(s, "-ts", strconv.Itoa(w), strconv.Itoa(h),
		"-r", "average", "-dstnodata", "nan", "-wo", "UNIFIED_SRC_NODATA=NO")
}

// BlockCutSwitches cuts one block of a source file at the mercator step
// pixel. nodata is the nodata of the source.
func BlockCutSwitches(box [4]float64, pixel, nodata float64) []string {
	step := fmt.Sprintf("%.6f", pixel)
	s := []string{"-t_srs", Mercator, "-te"}
	s = append(s, extent(box)...)
	return append(s, "-tr", step, step, "-r", "average", "-ot", "Float32",
		"-srcnodata", pyjson.PyFloat(nodata), "-dstnodata", "nan")
}

// PreviewSwitches lets GDAL choose extent and step. The manifest bounds come
// from its result.
func PreviewSwitches() []string {
	return []string{"-t_srs", Mercator, "-r", "bilinear", "-dstnodata", "nan"}
}

// ToTileGrid warps src onto the tile block (tx0, ty0)..(tx1, ty1) of zoom z.
func ToTileGrid(w Warper, src Source, tx0, ty0, tx1, ty1, z int) (Raster, error) {
	box := geo.TileBox(tx0, ty0, tx1, ty1, z)
	return w.Warp(src, TileGridSwitches(box, (tx1-tx0+1)*geo.TileSize, (ty1-ty0+1)*geo.TileSize))
}

// AutoBounds3857 returns the extent (west, south, east, north) that gdalwarp
// chooses for src in EPSG:3857.
func AutoBounds3857(w Warper, src Source) ([4]float64, error) {
	r, err := w.Warp(src, PreviewSwitches())
	if err != nil {
		return [4]float64{}, err
	}
	return r.Bounds(), nil
}

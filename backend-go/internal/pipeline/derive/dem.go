package derive

import (
	"context"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"slices"

	"github.com/airbusgeo/godal"
)

// DEMStep is the step of the terrain rasters in metres (static_features.py).
const DEMStep = 90

// DEMFiles are the terrain rasters of static_features.py in EPSG:3035 at
// 90 m. The fine layers hoehe, hangneigung and nordexposition read them.
type DEMFiles struct {
	VRT       string // mosaic of the uploaded tiles
	DEM       string // dem90_3035.tif, bilinear
	Slope     string // slope90.tif, degrees, nodata -9999
	Aspect    string // aspect90.tif, degrees, 0 for flat ground
	Northness string // northness90.tif, cos of the aspect
	Eastness  string // eastness90.tif, sin of the aspect
}

// BuildDEM makes the terrain rasters in dir from the DEM tiles, as
// static_features.main: one VRT, a bilinear warp to 90 m over the grid,
// then gdaldem slope and aspect with compute_edges.
func BuildDEM(ctx context.Context, tiles []string, g Grid, dir string) (DEMFiles, error) {
	f := DEMFiles{
		VRT: filepath.Join(dir, "dem.vrt"), DEM: filepath.Join(dir, "dem90_3035.tif"),
		Slope: filepath.Join(dir, "slope90.tif"), Aspect: filepath.Join(dir, "aspect90.tif"),
		Northness: filepath.Join(dir, "northness90.tif"), Eastness: filepath.Join(dir, "eastness90.tif"),
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return f, err
	}
	registerGDAL()
	sorted := slices.Sorted(slices.Values(tiles))
	vrt, err := godal.BuildVRT(f.VRT, sorted, nil)
	if err != nil {
		return f, fmt.Errorf("derive: build VRT: %w", err)
	}
	if err := vrt.Close(); err != nil {
		return f, err
	}
	steps := []func() error{
		func() error {
			src, err := openRaster(f.VRT)
			if err != nil {
				return err
			}
			defer src.Close()
			step := itoa(DEMStep)
			return warpFile(src, f.DEM, append(append([]string{"-t_srs", ModelCRS, "-te"}, g.Extent()...),
				"-tr", step, step, "-r", "bilinear"))
		},
		func() error { return demProcess(f.DEM, f.Slope, "slope", "-compute_edges") },
		func() error { return demProcess(f.DEM, f.Aspect, "aspect", "-compute_edges", "-zero_for_flat") },
		func() error { return writeAngle(f.Aspect, f.Northness, math.Cos) },
		func() error { return writeAngle(f.Aspect, f.Eastness, math.Sin) },
	}
	for _, step := range steps {
		if err := ctx.Err(); err != nil {
			return f, err
		}
		if err := step(); err != nil {
			return f, err
		}
	}
	return f, nil
}

// demProcess runs gdaldem into a GeoTIFF file.
func demProcess(source, target, mode string, switches ...string) error {
	src, err := openRaster(source)
	if err != nil {
		return err
	}
	defer src.Close()
	out, err := src.Dem(target, mode, "", append([]string{"-of", "GTiff"}, switches...))
	if err != nil {
		return fmt.Errorf("derive: gdaldem %s: %w", mode, err)
	}
	return out.Close()
}

// writeAngle writes cos or sin of the aspect in float32, as the northness
// and eastness loop of static_features.py. The file keeps the nodata value
// of the aspect; the masked points hold NaN.
func writeAngle(aspect, target string, f func(float64) float64) error {
	src, err := openRaster(aspect)
	if err != nil {
		return err
	}
	defer src.Close()
	angle, err := readMasked(src, 0)
	if err != nil {
		return err
	}
	radians := float32(math.Pi) / 180
	values := make([]float32, len(angle))
	for i, a := range angle {
		values[i] = float32(f(float64(a * radians)))
	}
	gt, err := src.GeoTransform()
	if err != nil {
		return err
	}
	nx, ny := size(src)
	registerGDAL()
	ds, err := godal.Create(godal.GTiff, target, 1, godal.Float32, nx, ny, godal.CreationOption("COMPRESS=DEFLATE"))
	if err != nil {
		return err
	}
	err = describeLike(ds, gt, src.Projection(), values, nx, ny, src)
	if cerr := ds.Close(); err == nil {
		err = cerr
	}
	return err
}

func describeLike(ds *godal.Dataset, gt [6]float64, wkt string, values []float32, nx, ny int, like *godal.Dataset) error {
	if err := ds.SetGeoTransform(gt); err != nil {
		return err
	}
	if err := ds.SetProjection(wkt); err != nil {
		return err
	}
	band := ds.Bands()[0]
	if nd, ok := nodataOf(like); ok {
		if err := band.SetNoData(nd); err != nil {
			return err
		}
	}
	return band.Write(0, 0, values, nx, ny)
}

package derive

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"sync"

	"github.com/airbusgeo/godal"
)

var registerGDAL = sync.OnceFunc(godal.RegisterAll)

// quiet lets GDAL warnings pass. A failure stays an error.
var quiet = godal.ErrLogger(func(ec godal.ErrorCategory, _ int, msg string) error {
	if ec > godal.CE_Warning {
		return errors.New(msg)
	}
	return nil
})

// openRaster opens a raster file or a GDAL virtual path.
func openRaster(path string) (*godal.Dataset, error) {
	registerGDAL()
	ds, err := godal.Open(path)
	if err != nil {
		return nil, fmt.Errorf("derive: open %s: %w", path, err)
	}
	return ds, nil
}

// warpMem runs gdalwarp into a MEM dataset. The switches have no "-q",
// "-overwrite" and file names.
func warpMem(src *godal.Dataset, switches []string) (*godal.Dataset, error) {
	out, err := src.Warp("", switches, godal.Memory, quiet)
	if err != nil {
		return nil, fmt.Errorf("derive: warp %v: %w", switches, err)
	}
	return out, nil
}

// warpFile runs gdalwarp into a GeoTIFF file.
func warpFile(src *godal.Dataset, target string, switches []string) error {
	out, err := src.Warp(target, switches, godal.GTiff, quiet)
	if err != nil {
		return fmt.Errorf("derive: warp %s %v: %w", target, switches, err)
	}
	return out.Close()
}

// size gives the width and the height of a dataset.
func size(ds *godal.Dataset) (int, int) {
	st := ds.Structure()
	return st.SizeX, st.SizeY
}

// readBytes reads band 1 as bytes.
func readBytes(ds *godal.Dataset) ([]uint8, error) {
	nx, ny := size(ds)
	buf := make([]uint8, nx*ny)
	return buf, ds.Bands()[0].Read(0, 0, buf, nx, ny)
}

// readMasked reads a band as float32 with NaN for each nodata point, as
// rasterio read(masked=True).filled(nan).astype("float32").
func readMasked(ds *godal.Dataset, band int) ([]float32, error) {
	nx, ny := size(ds)
	buf := make([]float32, nx*ny)
	b := ds.Bands()[band]
	if err := b.Read(0, 0, buf, nx, ny); err != nil {
		return nil, err
	}
	nodata, ok := b.NoData()
	if !ok {
		return buf, nil
	}
	nd := float32(nodata)
	for i, v := range buf {
		if v == nd {
			buf[i] = nanOf()
		}
	}
	return buf, nil
}

// readRawFloat reads a band as float32 without a mask, as rasterio read().
func readRawFloat(ds *godal.Dataset, band int) ([]float32, error) {
	nx, ny := size(ds)
	buf := make([]float32, nx*ny)
	return buf, ds.Bands()[band].Read(0, 0, buf, nx, ny)
}

// nodataOf gives the nodata value of band 1, or NaN with false.
func nodataOf(ds *godal.Dataset) (float64, bool) {
	nd, ok := ds.Bands()[0].NoData()
	if !ok {
		return math.NaN(), false
	}
	return nd, true
}

// RasterBounds gives minX, minY, maxX, maxY of a north-up raster.
func RasterBounds(gt [6]float64, nx, ny int) [4]float64 {
	x0, x1 := gt[0], gt[0]+float64(nx)*gt[1]
	y0, y1 := gt[3], gt[3]+float64(ny)*gt[5]
	return [4]float64{min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)}
}

// epsgOfDataset gives the EPSG code of the CRS of a dataset, or 0.
func epsgOfDataset(ds *godal.Dataset) int {
	sr := ds.SpatialRef()
	if sr == nil {
		return 0
	}
	defer sr.Close()
	if sr.AuthorityName("") != "EPSG" && (sr.AutoIdentifyEPSG() != nil || sr.AuthorityName("") != "EPSG") {
		return 0
	}
	code, err := strconv.Atoi(sr.AuthorityCode(""))
	if err != nil {
		return 0
	}
	return code
}

// buildVRT runs gdalbuildvrt over the files.
func buildVRT(target string, files []string) (*godal.Dataset, error) {
	registerGDAL()
	ds, err := godal.BuildVRT(target, files, nil, quiet)
	if err != nil {
		return nil, fmt.Errorf("derive: build VRT: %w", err)
	}
	return ds, nil
}

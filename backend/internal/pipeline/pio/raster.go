package pio

import (
	"fmt"
	"math"
	"strconv"
	"sync"

	"github.com/airbusgeo/godal"
)

var registerGDAL = sync.OnceFunc(godal.RegisterAll)

// RasterInfo describes a raster file without its pixel data.
// GT is the GDAL geotransform. EPSG is 0 when GDAL finds no EPSG code for the CRS.
type RasterInfo struct {
	CRS       string
	EPSG      int
	GT        [6]float64
	NX, NY    int
	Bands     int
	DType     string
	Nodata    float64
	HasNodata bool
}

// PixelSize gives the absolute pixel width and height in CRS units.
func (r RasterInfo) PixelSize() (float64, float64) {
	return math.Hypot(r.GT[1], r.GT[4]), math.Hypot(r.GT[2], r.GT[5])
}

// Bounds gives minX, minY, maxX, maxY of a north-up raster in CRS units.
func (r RasterInfo) Bounds() [4]float64 {
	x0, x1 := r.GT[0], r.GT[0]+float64(r.NX)*r.GT[1]
	y0, y1 := r.GT[3], r.GT[3]+float64(r.NY)*r.GT[5]
	return [4]float64{min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)}
}

// Probe opens a raster with GDAL and reads its size, CRS, geotransform, data type
// and nodata value of band 1. Paths like /vsizip/a.zip/b.tif work.
func Probe(path string) (RasterInfo, error) {
	registerGDAL()
	ds, err := godal.Open(path)
	if err != nil {
		return RasterInfo{}, fmt.Errorf("pio: probe %s: %w", path, err)
	}
	defer func() { _ = ds.Close() }()
	st := ds.Structure()
	info := RasterInfo{NX: st.SizeX, NY: st.SizeY, Bands: st.NBands, DType: st.DataType.String()}
	if gt, err := ds.GeoTransform(); err == nil {
		info.GT = gt
	} else {
		info.GT = [6]float64{0, 1, 0, 0, 0, 1}
	}
	if bands := ds.Bands(); len(bands) > 0 {
		info.Nodata, info.HasNodata = bands[0].NoData()
		info.DType = bands[0].Structure().DataType.String()
	}
	info.CRS = ds.Projection()
	if info.CRS != "" {
		info.EPSG = epsgOf(info.CRS)
	}
	return info, nil
}

// epsgOf finds the EPSG code of a WKT CRS, or gives 0.
func epsgOf(wkt string) int {
	sr, err := godal.NewSpatialRefFromWKT(wkt)
	if err != nil {
		return 0
	}
	defer sr.Close()
	if sr.AuthorityName("") != "EPSG" {
		if sr.AutoIdentifyEPSG() != nil || sr.AuthorityName("") != "EPSG" {
			return 0
		}
	}
	code, err := strconv.Atoi(sr.AuthorityCode(""))
	if err != nil {
		return 0
	}
	return code
}

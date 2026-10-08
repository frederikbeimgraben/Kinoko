// Package tiles warps fields onto the XYZ tile grid and writes the tile
// pyramids of the chain, as tiles.py and pyramid.py. A tile carries a value
// byte per point: 0 is no data, 1..255 is the share 0..1 of the scale.
package tiles

import (
	"fmt"
	"math"
	"strconv"
	"sync"

	"github.com/airbusgeo/godal"
)

// Raster is a field of float32 bands in one CRS. Each band holds NY rows of
// NX points, north row first. NaN is no data in every band.
type Raster struct {
	Bands        [][]float32
	NX, NY       int
	GeoTransform [6]float64
	EPSG         int
}

// Bounds returns the extent (west, south, east, north) of a north-up raster.
func (r Raster) Bounds() [4]float64 {
	gt := r.GeoTransform
	west, north := gt[0], gt[3]
	east := west + float64(r.NX)*gt[1]
	south := north + float64(r.NY)*gt[5]
	return [4]float64{west, south, east, north}
}

// Source is an input of a warp: a Raster in memory or a raster file.
type Source interface {
	open() (*godal.Dataset, error)
}

// File is a raster file that GDAL opens. Its own nodata values apply.
type File string

var register sync.Once

func registerDrivers() { register.Do(godal.RegisterAll) }

func (f File) open() (*godal.Dataset, error) {
	registerDrivers()
	return godal.Open(string(f))
}

// open copies the raster into a MEM dataset with NaN as the nodata of each
// band, as the GeoTIFF that the Python chain writes with nodata=nan.
func (r Raster) open() (*godal.Dataset, error) {
	registerDrivers()
	if len(r.Bands) == 0 {
		return nil, fmt.Errorf("tiles: raster has no band")
	}
	ds, err := godal.Create(godal.Memory, "", len(r.Bands), godal.Float32, r.NX, r.NY)
	if err != nil {
		return nil, err
	}
	if err := describe(ds, r); err != nil {
		_ = ds.Close()
		return nil, err
	}
	return ds, nil
}

func describe(ds *godal.Dataset, r Raster) error {
	if err := ds.SetGeoTransform(r.GeoTransform); err != nil {
		return err
	}
	srs, err := godal.NewSpatialRefFromEPSG(r.EPSG)
	if err != nil {
		return err
	}
	defer srs.Close()
	if err := ds.SetSpatialRef(srs); err != nil {
		return err
	}
	for i, band := range ds.Bands() {
		if len(r.Bands[i]) != r.NX*r.NY {
			return fmt.Errorf("tiles: band %d has %d points, want %d", i+1, len(r.Bands[i]), r.NX*r.NY)
		}
		if err := band.SetNoData(math.NaN()); err != nil {
			return err
		}
		if err := band.Write(0, 0, r.Bands[i], r.NX, r.NY); err != nil {
			return err
		}
	}
	return nil
}

// readRaster reads every band of a dataset as float32.
func readRaster(ds *godal.Dataset) (Raster, error) {
	st := ds.Structure()
	gt, err := ds.GeoTransform()
	if err != nil {
		return Raster{}, err
	}
	out := Raster{NX: st.SizeX, NY: st.SizeY, GeoTransform: gt, EPSG: epsgOf(ds)}
	for _, band := range ds.Bands() {
		buf := make([]float32, st.SizeX*st.SizeY)
		if err := band.Read(0, 0, buf, st.SizeX, st.SizeY); err != nil {
			return Raster{}, err
		}
		out.Bands = append(out.Bands, buf)
	}
	return out, nil
}

func epsgOf(ds *godal.Dataset) int {
	if ds.Projection() == "" {
		return 0
	}
	srs := ds.SpatialRef()
	defer srs.Close()
	code, err := strconv.Atoi(srs.AuthorityCode(""))
	if err != nil {
		return 0
	}
	return code
}

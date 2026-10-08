package pio

import (
	"archive/zip"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/airbusgeo/godal"
)

// writeTiff writes a 64x48 GeoTIFF in EPSG:3035 with 10 m pixels.
func writeTiff(t *testing.T, path string, dtype godal.DataType, nodata *float64) {
	t.Helper()
	registerGDAL()
	ds, err := godal.Create(godal.GTiff, path, 1, dtype, 64, 48)
	if err != nil {
		t.Fatal(err)
	}
	sr, err := godal.NewSpatialRefFromEPSG(3035)
	if err != nil {
		t.Fatal(err)
	}
	defer sr.Close()
	if err := ds.SetSpatialRef(sr); err != nil {
		t.Fatal(err)
	}
	if err := ds.SetGeoTransform([6]float64{4000000, 10, 0, 3000480, 0, -10}); err != nil {
		t.Fatal(err)
	}
	if nodata != nil {
		if err := ds.Bands()[0].SetNoData(*nodata); err != nil {
			t.Fatal(err)
		}
	}
	if err := ds.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestProbe(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "trees.tif")
	nodata := -32767.0
	writeTiff(t, path, godal.Int16, &nodata)
	info, err := Probe(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.NX != 64 || info.NY != 48 || info.Bands != 1 || info.DType != "Int16" {
		t.Errorf("structure = %+v", info)
	}
	if info.EPSG != 3035 || info.CRS == "" {
		t.Errorf("crs = %d %q", info.EPSG, info.CRS)
	}
	if !info.HasNodata || info.Nodata != nodata {
		t.Errorf("nodata = %v %v", info.Nodata, info.HasNodata)
	}
	if px, py := info.PixelSize(); px != 10 || py != 10 {
		t.Errorf("pixel size %v %v", px, py)
	}
	if b := info.Bounds(); b != [4]float64{4000000, 3000000, 4000640, 3000480} {
		t.Errorf("bounds %v", b)
	}
	if _, err := Probe(filepath.Join(dir, "missing.tif")); err == nil {
		t.Error("missing file gives no error")
	}
}

func TestProbeInsideZip(t *testing.T) {
	dir := t.TempDir()
	tif := filepath.Join(dir, "a.tif")
	writeTiff(t, tif, godal.Byte, nil)
	zpath := filepath.Join(dir, "tiles.zip")
	out, err := os.Create(zpath)
	if err != nil {
		t.Fatal(err)
	}
	zw := zip.NewWriter(out)
	w, err := zw.Create("tiles/a.tif")
	if err != nil {
		t.Fatal(err)
	}
	in, err := os.Open(tif)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = in.Close() }()
	if _, err := io.Copy(w, in); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := out.Close(); err != nil {
		t.Fatal(err)
	}
	info, err := Probe("/vsizip/" + zpath + "/tiles/a.tif")
	if err != nil {
		t.Fatal(err)
	}
	if info.DType != "Byte" || info.HasNodata || info.EPSG != 3035 {
		t.Errorf("info = %+v", info)
	}
}

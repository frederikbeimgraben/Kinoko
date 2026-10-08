package derive

import (
	"fmt"
	"math"
	"slices"

	"github.com/airbusgeo/godal"
)

// sampleSide is the edge of the decimated read that the checks use.
const sampleSide = 1024

// RasterReport is the validation report of one raster upload.
type RasterReport struct {
	EPSG     int
	CRS      string
	NX, NY   int
	Bands    int
	DType    string
	Nodata   *float64
	PixelM   float64
	Bounds   [4]float64 // in the CRS of the raster
	Coverage float64    // share of the grid box inside the raster extent
}

// Meta gives the report as version metadata.
func (r RasterReport) Meta() map[string]any {
	m := map[string]any{"epsg": r.EPSG, "size": []int{r.NX, r.NY}, "bands": r.Bands,
		"dtype": r.DType, "pixelM": r.PixelM, "bbox": r.Bounds[:], "coverage": r.Coverage}
	if r.Nodata != nil {
		m["nodata"] = *r.Nodata
	}
	return m
}

// Inspect reads the report of a raster and measures how much of the grid
// box in EPSG:3035 its extent covers.
func Inspect(ds *godal.Dataset, g Grid) (RasterReport, error) {
	st := ds.Structure()
	r := RasterReport{NX: st.SizeX, NY: st.SizeY, Bands: st.NBands, EPSG: epsgOfDataset(ds), CRS: ds.Projection()}
	if st.NBands > 0 {
		r.DType = ds.Bands()[0].Structure().DataType.String()
		if nd, ok := nodataOf(ds); ok {
			r.Nodata = &nd
		}
	}
	gt, err := ds.GeoTransform()
	if err != nil {
		return r, fmt.Errorf("derive: the raster has no geotransform: %w", err)
	}
	r.Bounds = RasterBounds(gt, r.NX, r.NY)
	r.PixelM = math.Abs(gt[1])
	if sr := ds.SpatialRef(); sr != nil {
		if sr.Geographic() {
			r.PixelM *= 111_320 * math.Cos(52*math.Pi/180)
		}
		sr.Close()
	}
	box, err := boundsIn3035(ds, r.Bounds)
	if err != nil {
		return r, err
	}
	r.Coverage = overlap(box, [4]float64{float64(g.X0), float64(g.Y0), float64(g.X1), float64(g.Y1)})
	return r, nil
}

// boundsIn3035 projects the edge points of a box to EPSG:3035 and gives
// their extent.
func boundsIn3035(ds *godal.Dataset, b [4]float64) ([4]float64, error) {
	src := ds.SpatialRef()
	if src == nil {
		return [4]float64{}, fmt.Errorf("derive: the raster has no CRS")
	}
	defer src.Close()
	dst, err := godal.NewSpatialRefFromEPSG(3035)
	if err != nil {
		return [4]float64{}, err
	}
	defer dst.Close()
	t, err := godal.NewTransform(src, dst)
	if err != nil {
		return [4]float64{}, err
	}
	defer t.Close()
	const n = 16
	var xs, ys []float64
	for i := range n + 1 {
		f := float64(i) / n
		x, y := b[0]+f*(b[2]-b[0]), b[1]+f*(b[3]-b[1])
		xs = append(xs, x, x, b[0], b[2])
		ys = append(ys, b[1], b[3], y, y)
	}
	if err := t.TransformEx(xs, ys, nil, nil); err != nil {
		return [4]float64{}, err
	}
	return [4]float64{slices.Min(xs), slices.Min(ys), slices.Max(xs), slices.Max(ys)}, nil
}

// overlap gives the share of box b that box a covers.
func overlap(a, b [4]float64) float64 {
	w := math.Min(a[2], b[2]) - math.Max(a[0], b[0])
	h := math.Min(a[3], b[3]) - math.Max(a[1], b[1])
	if w <= 0 || h <= 0 {
		return 0
	}
	return w * h / ((b[2] - b[0]) * (b[3] - b[1]))
}

// sampleBand reads band 1 decimated to at most sampleSide points per edge,
// with the nearest neighbour.
func sampleBand(ds *godal.Dataset) ([]float32, error) {
	nx, ny := size(ds)
	w, h := min(nx, sampleSide), min(ny, sampleSide)
	buf := make([]float32, w*h)
	err := ds.Bands()[0].Read(0, 0, buf, w, h, godal.Window(nx, ny), godal.Resampling(godal.Nearest))
	return buf, err
}

// ClassHistogram counts the values of a decimated read of a class raster.
func ClassHistogram(ds *godal.Dataset) (map[int]int, error) {
	values, err := sampleBand(ds)
	if err != nil {
		return nil, err
	}
	counts := map[int]int{}
	for _, v := range values {
		counts[int(v)]++
	}
	return counts, nil
}

// ValueRange gives the least and the greatest value of a decimated read,
// without nodata and NaN. ok is false when no value is valid.
func ValueRange(ds *godal.Dataset) (lo, hi float64, ok bool, err error) {
	values, err := sampleBand(ds)
	if err != nil {
		return 0, 0, false, err
	}
	nd, hasND := nodataOf(ds)
	lo, hi = math.Inf(1), math.Inf(-1)
	for _, v := range values {
		f := float64(v)
		if math.IsNaN(f) || (hasND && v == float32(nd)) {
			continue
		}
		lo, hi = math.Min(lo, f), math.Max(hi, f)
	}
	return lo, hi, !math.IsInf(lo, 1), nil
}

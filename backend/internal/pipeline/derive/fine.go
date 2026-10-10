package derive

import (
	"math"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// Credits of the sources that CC BY 4.0 asks for.
const (
	thuenen    = "10-m-Raster, Thünen-Institut, Dominant Tree Species for Germany (2017/2018), CC BY 4.0"
	copernicus = "90-m-Raster, Copernicus DEM GLO-90"
	soilGrids  = "250-m-Raster, SoilGrids, ISRIC"
)

// LayerSource tells where a fine layer reads its values.
type LayerSource int

// The sources of the fine layers.
const (
	SourceTrees     LayerSource = iota // the tree species map
	SourceDEM                          // dem90_3035.tif
	SourceSlope                        // slope90.tif
	SourceNorthness                    // northness90.tif
	SourceSoil                         // a SoilGrids file, see FineLayer.Soil
)

// FineLayer is one static layer, its source and the scale of a byte.
type FineLayer struct {
	Name        string
	Label       string
	Unit        string
	Resolution  float64
	Low, High   float64
	Note        string
	Classes     []int
	Source      LayerSource
	Soil        string // the SoilGrids stem, e.g. "phh2o_0-5cm"
	Scale       float64
	Nodata      float64
	OfflineZoom int
}

// Wald is the forest share layer. It has no classes.
const Wald = "wald"

func treeLayer(name, label string, classes ...int) FineLayer {
	return FineLayer{Name: name, Label: label, Resolution: 10, Low: 0, High: 1, Note: thuenen,
		Classes: classes, Source: SourceTrees, Scale: 1, OfflineZoom: 12}
}

func rasterLayer(name, label, unit string, res, low, high float64, note string, src LayerSource, nodata, scale float64) FineLayer {
	return FineLayer{Name: name, Label: label, Unit: unit, Resolution: res, Low: low, High: high, Note: note,
		Source: src, Scale: scale, Nodata: nodata, OfflineZoom: 12}
}

// FineLayers are the static layers in this order: the tree layers, then the raster layers.
var FineLayers = []FineLayer{
	treeLayer(Wald, "Waldanteil"),
	treeLayer("fichte", "Fichte", 8),
	treeLayer("buche", "Buche", 3),
	treeLayer("eiche", "Eiche", 5),
	treeLayer("birke", "Birke", 2),
	treeLayer("kiefer", "Kiefer", 9),
	treeLayer("nadelholz", "Nadelholz", 4, 8, 9, 10, 14),
	rasterLayer("hoehe", "Höhe", "m", 90, 0, 2000, copernicus, SourceDEM, -32767, 1),
	rasterLayer("hangneigung", "Hangneigung", "Grad", 90, 0, 45, copernicus, SourceSlope, -9999, 1),
	rasterLayer("nordexposition", "Nordexposition", "", 90, -1, 1, copernicus, SourceNorthness, -9999, 1),
	withSoil(rasterLayer("boden_ph", "Boden-pH", "", 250, 3.5, 8.5, soilGrids, SourceSoil, 0, 0.1), "phh2o_0-5cm"),
	withSoil(rasterLayer("boden_sand", "Sandanteil", "%", 250, 0, 100, soilGrids, SourceSoil, 0, 0.1), "sand_0-5cm"),
	withSoil(rasterLayer("boden_kohlenstoff", "organischer Kohlenstoff", "g/kg", 250, 0, 200, soilGrids, SourceSoil, 0, 0.1), "soc_0-5cm"),
}

func withSoil(l FineLayer, stem string) FineLayer {
	l.Soil = stem
	return l
}

// Zoom gives the finest zoom that the source of the layer carries.
func (l FineLayer) Zoom(cap int) int { return geo.FinestZoom(l.Resolution, cap, geo.ZoomBase) }

// ScaleField reads a source field as a share 0..1 of the layer scale:
// nodata and NaN give NaN. The arithmetic is float32.
func ScaleField(raw []float32, l FineLayer) []float32 {
	nodata := float32(l.Nodata)
	scale, low, width := float32(l.Scale), float32(l.Low), float32(l.High-l.Low)
	out := make([]float32, len(raw))
	for i, v := range raw {
		if math.IsNaN(float64(v)) || math.IsInf(float64(v), 0) || v == nodata {
			out[i] = nanOf()
			continue
		}
		out[i] = min(max((v*scale-low)/width, 0), 1)
	}
	return out
}

// TreeField gives the field of one tree layer from a block of class numbers,
// as tree_fields. Wald is 1 on forest, 0 on other ground and NaN outside
// the inland mask. A species is 1 or 0 on forest and NaN on other ground.
func TreeField(classes, inland []uint8, l FineLayer) []float32 {
	out := make([]float32, len(classes))
	for i, c := range classes {
		forest := c > 0
		switch {
		case l.Name == Wald && inland[i] == 0:
			out[i] = nanOf()
		case l.Name == Wald && forest:
			out[i] = 1
		case l.Name == Wald:
			out[i] = 0
		case !forest:
			out[i] = nanOf()
		case slices.Contains(l.Classes, int(c)):
			out[i] = 1
		}
	}
	return out
}

// LayerValues gives the values behind the bytes of value tiles, as
// werte_aus_kacheln: low + (b-1)/254*(high-low) in float32 for each b > 0.
func LayerValues(tiles [][]uint8, low, high float64) []float32 {
	var out []float32
	width := float32(high - low)
	for _, t := range tiles {
		for _, b := range t {
			if b > 0 {
				out = append(out, float32(low)+(float32(b)-1)/254*width)
			}
		}
	}
	return out
}

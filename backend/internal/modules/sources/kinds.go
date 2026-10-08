package sources

import (
	"slices"
	"strings"
)

// Kind is the kind of an uploaded data source.
type Kind string

// The kinds of data source. The contract enum DataSourceKind lists the same values.
const (
	KindGBIFArchive        Kind = "gbif-archive"
	KindTreeSpeciesMap     Kind = "tree-species-map"
	KindDEM                Kind = "dem"
	KindSoilGrids          Kind = "soilgrids"
	KindGermanyOutline     Kind = "germany-outline"
	KindTreesGrid          Kind = "trees-grid"
	KindTreeScales         Kind = "tree-scales"
	KindSiteGrid           Kind = "site-grid"
	KindWeatherCheckpoints Kind = "weather-checkpoints"
	KindModelBundle        Kind = "model-bundle"
	KindStaticLayers       Kind = "static-layers"
)

// Uses of a data source in the pipeline.
const (
	UseTraining    = "training"
	UseRender      = "render"
	UseLayers      = "layers"
	UseOccurrences = "occurrences"
)

const (
	kib int64 = 1 << 10
	mib       = kib << 10
	gib       = mib << 10
)

// KindSpec tells what a kind of data source accepts and what it is for.
type KindSpec struct {
	Kind       Kind
	Required   bool
	PerSpecies bool
	UsedBy     []string
	Extensions []string
	MediaTypes []string
	MaxBytes   int64
}

// Kinds lists each kind in the order of the overview.
var Kinds = []KindSpec{
	{KindGBIFArchive, false, false, []string{UseOccurrences}, []string{".zip"}, []string{"application/zip"}, 20 * gib},
	{KindTreeSpeciesMap, false, false, []string{UseTraining, UseRender, UseLayers}, []string{".tif", ".tiff", ".zip"}, []string{"image/tiff", "application/zip"}, 12 * gib},
	{KindDEM, false, false, []string{UseRender, UseLayers}, []string{".tif", ".tiff", ".zip"}, []string{"image/tiff", "application/zip"}, 4 * gib},
	{KindSoilGrids, false, false, []string{UseRender, UseLayers}, []string{".zip"}, []string{"application/zip"}, 2 * gib},
	{KindGermanyOutline, false, false, []string{UseLayers}, []string{".geojson", ".json"}, []string{"application/geo+json", "application/json"}, 100 * mib},
	{KindTreesGrid, true, false, []string{UseRender}, []string{".parquet"}, []string{"application/vnd.apache.parquet"}, 2 * gib},
	{KindTreeScales, true, false, []string{UseTraining, UseRender}, []string{".parquet"}, []string{"application/vnd.apache.parquet"}, 2 * gib},
	{KindSiteGrid, true, false, []string{UseRender, UseLayers}, []string{".parquet"}, []string{"application/vnd.apache.parquet"}, 2 * gib},
	{KindWeatherCheckpoints, false, false, []string{UseTraining, UseRender}, []string{".zip"}, []string{"application/zip"}, 2 * gib},
	{KindModelBundle, true, true, []string{UseRender}, []string{".zip"}, []string{"application/zip"}, 500 * mib},
	{KindStaticLayers, false, false, []string{UseLayers}, []string{".zip"}, []string{"application/zip"}, 15 * gib},
}

// RequiredKinds lists the kinds that a render run needs. The admin summary
// query in package access names the same kinds.
var RequiredKinds = []Kind{KindTreesGrid, KindTreeScales, KindSiteGrid, KindModelBundle}

// SpecOf gives the spec of a kind.
func SpecOf(kind Kind) (KindSpec, bool) {
	i := slices.IndexFunc(Kinds, func(s KindSpec) bool { return s.Kind == kind })
	if i < 0 {
		return KindSpec{}, false
	}
	return Kinds[i], true
}

// Valid tells if the kind is known.
func (k Kind) Valid() bool {
	_, ok := SpecOf(k)
	return ok
}

// extensionOf gives the accepted extension that ends the file name, in lower case.
func (s KindSpec) extensionOf(fileName string) (string, bool) {
	lower := strings.ToLower(fileName)
	i := slices.IndexFunc(s.Extensions, func(ext string) bool {
		return strings.HasSuffix(lower, ext) && len(lower) > len(ext)
	})
	if i < 0 {
		return "", false
	}
	return s.Extensions[i], true
}

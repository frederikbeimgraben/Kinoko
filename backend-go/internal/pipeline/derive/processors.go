package derive

import (
	"context"
	"errors"
	"os"
	"path/filepath"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
)

// Artifact names of the derived products. The prepared kinds trees-grid,
// tree-scales and site-grid use the same names.
const (
	ArtTreesGrid  = "trees_de_500m"
	ArtTreeScales = "tree_scales"
	ArtSite       = "site_500m"
	ArtSiteDEM    = "site_dem_500m"
	ArtSiteSoil   = "site_soil_500m"
)

// Config holds what the processors share. A zero Grid is the Germany grid
// at 500 m; zero FineOptions take the defaults of fine_layers.py.
type Config struct {
	Resolve  sources.Resolver
	Grid     Grid
	TreeTile int
	Fine     FineOptions
}

func (c Config) grid() Grid {
	if c.Grid == (Grid{}) {
		return GridOf(Germany, CellStep)
	}
	return c.Grid
}

// Processors gives the processors of the raw raster kinds.
func Processors(cfg Config) map[sources.Kind]sources.Processor {
	return map[sources.Kind]sources.Processor{
		sources.KindTreeSpeciesMap: TreeMap{cfg},
		sources.KindDEM:            DEM{cfg},
		sources.KindSoilGrids:      SoilGrids{cfg},
	}
}

// Register registers the processors with the sources module. Call it once
// at the start of the service, before the module resumes its work.
func Register(cfg Config) {
	for kind, p := range Processors(cfg) {
		sources.Register(kind, p)
	}
}

// artifactsOf gives the artifacts of files and folders under dir, named by
// their path relative to dir with the extension of a file removed.
func artifactsOf(dir string, rel ...string) ([]sources.Artifact, error) {
	out := make([]sources.Artifact, 0, len(rel))
	for _, r := range rel {
		p := filepath.Join(dir, filepath.FromSlash(r))
		size, err := treeSize(p)
		if err != nil {
			return nil, err
		}
		name := r
		if ext := filepath.Ext(r); ext == ".parquet" || ext == ".tif" {
			name = r[:len(r)-len(ext)]
		}
		out = append(out, sources.Artifact{Name: name, Path: p, SizeBytes: size})
	}
	return out, nil
}

func treeSize(p string) (int64, error) {
	var total int64
	err := filepath.WalkDir(p, func(_ string, e os.DirEntry, err error) error {
		if err != nil || e.IsDir() {
			return err
		}
		info, err := e.Info()
		if err == nil {
			total += info.Size()
		}
		return err
	})
	return total, err
}

// optionalPath resolves an artifact of the active version of a kind. A
// missing version gives "" without an error.
func (c Config) optionalPath(kind sources.Kind, artifact string) (string, error) {
	if c.Resolve == nil {
		return "", nil
	}
	p, err := c.Resolve.Path(kind, artifact)
	if errors.Is(err, sources.ErrMissing) {
		return "", nil
	}
	return p, err
}

// renderFine renders the fine layers of the inputs into the derived folder
// and gives the artifacts layers.json and layers_kacheln/<name>, as the
// static-layers kind.
func (c Config) renderFine(ctx context.Context, v *sources.Version, in FineInputs) ([]sources.Artifact, error) {
	opt := c.Fine
	opt.Log = v.Logf
	out := v.DerivedDir()
	work := filepath.Join(out, "work")
	defer os.RemoveAll(work)
	layers, err := RenderFine(ctx, in, out, work, opt)
	if err != nil || len(layers) == 0 {
		return nil, err
	}
	rel := []string{LayersFile}
	for _, l := range layers {
		rel = append(rel, TilesFolder+"/"+l.Name)
	}
	return artifactsOf(out, rel...)
}

// writeSite writes site_500m.parquet from the column sets in the order of
// static_features.py: terrain first, then soil.
func writeSite(dir string, g Grid, dem, soil Columns) (string, error) {
	t, schema := SiteTable(g, dem, soil)
	return writeTable(dir, ArtSite, t, schema)
}

func writeColumns(dir, name string, g Grid, c Columns) error {
	t, schema := SiteTable(g, c)
	_, err := writeTable(dir, name, t, schema)
	return err
}

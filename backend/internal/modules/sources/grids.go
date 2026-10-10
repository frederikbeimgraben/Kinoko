package sources

import (
	"context"
	"errors"
	"math"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// treeClasses are the share columns of the trees grid: the eleven classes
// of the Thuenen map, then the conifer and broadleaf sums.
var treeClasses = []string{
	"birch", "beech", "douglas_fir", "oak", "alder", "spruce", "pine", "larch", "fir",
	"deciduous_long_lived", "deciduous_short_lived", "conifer", "broadleaf",
}

// scaleSuffixes are the radii of the tree scales grid.
var scaleSuffixes = []string{"500m", "1km", "2km", "5km"}

const (
	gridStep   = 500.0
	gridCentre = 250.0
)

func treeColumns() []string {
	return fn.Map(treeClasses, func(c string) string { return "tree_" + c })
}

// originalArtifact names the uploaded file as an artifact. A prepared table
// is used as it is.
func originalArtifact(v *Version, name string) []Artifact {
	return []Artifact{{Name: name, Path: v.Original(), SizeBytes: fn.Deref(v.SizeBytes, 0), SHA256: v.SHA256}}
}

// treesGrid checks a prepared trees_de_500m.parquet.
type treesGrid struct{ minRows, maxRows int64 }

func (g treesGrid) Validate(ctx context.Context, v *Version) (map[string]any, error) {
	t, err := openTable(v.Original())
	if err != nil {
		return nil, err
	}
	defer func() { _ = t.Close() }()
	columns := append([]string{"x", "y", "gx", "gy", "forest_fraction", "forest_pixels", "cell"}, treeColumns()...)
	if err := t.require(columns); err != nil {
		return nil, err
	}
	rows := t.rows()
	if rows < g.minRows || rows > g.maxRows {
		return nil, Fail("row_count", "%d rows, expected %d to %d", rows, g.minRows, g.maxRows)
	}
	v.Logf("%d rows", rows)
	bbox, err := cellCentres(t)
	if err != nil {
		return nil, err
	}
	if err := uniqueCells(t); err != nil {
		return nil, err
	}
	return map[string]any{"rows": rows, "bbox": bbox, "crs": "EPSG:3035"}, ctx.Err()
}

func (treesGrid) Derive(_ context.Context, v *Version) ([]Artifact, error) {
	return originalArtifact(v, "trees_de_500m"), nil
}

// cellCentres checks that each x and y is the centre of a 500 m cell and
// gives the extent of the centres.
func cellCentres(t *table) ([]float64, error) {
	box := []float64{math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)}
	for i, name := range []string{"x", "y"} {
		values, err := t.numbers(name)
		if err != nil {
			return nil, err
		}
		if bad, found := fn.Find(values, func(x float64) bool { return math.Mod(x, gridStep) != gridCentre }); found {
			return nil, Fail("grid", "%s = %v is not the centre of a 500 m cell", name, bad)
		}
		if len(values) > 0 {
			box[i], box[i+2] = slices.Min(values), slices.Max(values)
		}
	}
	return box, nil
}

func uniqueCells(t *table) error {
	cells, err := t.texts("cell")
	if err != nil {
		return err
	}
	if cell, found := firstDuplicate(cells); found {
		return Fail("duplicate_cell", "the cell %q occurs more than once", cell)
	}
	return nil
}

// treeScales checks a prepared tree_scales.parquet. Its row count must
// agree with the active trees grid when one exists.
type treeScales struct{ resolve Resolver }

func scaleColumns() []string {
	bases := append([]string{"forest_fraction"}, treeColumns()...)
	return fn.FlatMap(bases, func(base string) []string {
		return fn.Map(scaleSuffixes, func(s string) string { return base + "_" + s })
	})
}

func (s treeScales) Validate(ctx context.Context, v *Version) (map[string]any, error) {
	t, err := openTable(v.Original())
	if err != nil {
		return nil, err
	}
	defer func() { _ = t.Close() }()
	values := scaleColumns()
	if err := t.require(append([]string{"cell", "x", "y"}, values...)); err != nil {
		return nil, err
	}
	if err := t.requireFloat32(values); err != nil {
		return nil, err
	}
	meta := map[string]any{"rows": t.rows(), "columns": len(values) + 3}
	gridRows, err := s.gridRows()
	switch {
	case errors.Is(err, ErrMissing):
		v.Logf("no active trees-grid: the row count is not compared")
	case err != nil:
		return nil, err
	case gridRows != t.rows():
		return nil, Fail("row_count", "%d rows, the active trees-grid has %d", t.rows(), gridRows)
	default:
		meta["gridRows"] = gridRows
	}
	return meta, ctx.Err()
}

func (s treeScales) gridRows() (int64, error) {
	path, err := s.resolve.Path(KindTreesGrid, "trees_de_500m")
	if err != nil {
		return 0, err
	}
	grid, err := openTable(path)
	if err != nil {
		return 0, err
	}
	defer func() { _ = grid.Close() }()
	return grid.rows(), nil
}

func (treeScales) Derive(_ context.Context, v *Version) ([]Artifact, error) {
	return originalArtifact(v, "tree_scales"), nil
}

// siteGrid checks a prepared site_500m.parquet. The pH column is the water
// mask of the map, so it is necessary.
type siteGrid struct{}

var siteOptional = []string{"dem_mean", "dem_min", "dem_max", "dem_relief", "tpi_25km"}

func (siteGrid) Validate(ctx context.Context, v *Version) (map[string]any, error) {
	t, err := openTable(v.Original())
	if err != nil {
		return nil, err
	}
	defer func() { _ = t.Close() }()
	if err := t.require([]string{"cell", "soil_phh2o_0_5cm"}); err != nil {
		return nil, err
	}
	if err := uniqueCells(t); err != nil {
		return nil, err
	}
	names := t.names()
	present := fn.Filter(siteOptional, func(n string) bool { return slices.Contains(names, n) })
	return map[string]any{"rows": t.rows(), "columns": names, "optional": present}, ctx.Err()
}

func (siteGrid) Derive(_ context.Context, v *Version) ([]Artifact, error) {
	return originalArtifact(v, "site_500m"), nil
}

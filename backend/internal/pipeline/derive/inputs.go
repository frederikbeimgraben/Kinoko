package derive

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio/archive"
)

// SoilPattern is the accepted name of a SoilGrids file in the upload.
var SoilPattern = regexp.MustCompile(`^(clay|sand|silt|phh2o|soc|bdod|cfvo|nitrogen)_(0-5cm|5-15cm|15-30cm)_mean\.tif$`)

// SoilRequired are the SoilGrids files that the water mask and the fine
// layers need.
var SoilRequired = []string{"phh2o_0-5cm", "sand_0-5cm", "soc_0-5cm"}

func isTIFF(name string) bool {
	lower := strings.ToLower(name)
	return strings.HasSuffix(lower, ".tif") || strings.HasSuffix(lower, ".tiff")
}

// RasterFiles gives the GDAL paths of the rasters of an upload: the file
// itself, or each GeoTIFF of a zip as a /vsizip/ path in archive order.
// GDAL reads the zip entries in place, so nothing is unpacked.
func RasterFiles(upload string, keep func(base string) bool) ([]string, error) {
	if !strings.EqualFold(filepath.Ext(upload), ".zip") {
		return []string{upload}, nil
	}
	z, err := archive.OpenZip(upload)
	if err != nil {
		return nil, err
	}
	defer func() { _ = z.Close() }()
	abs, err := filepath.Abs(upload)
	if err != nil {
		return nil, err
	}
	names := z.Find(func(name string) bool { return isTIFF(name) && keep(path.Base(name)) })
	if len(names) == 0 {
		return nil, fmt.Errorf("derive: the archive %s has no GeoTIFF", filepath.Base(upload))
	}
	out := make([]string, len(names))
	for i, n := range names {
		out[i] = "/vsizip/" + abs + "/" + n
	}
	return out, nil
}

// Mosaic gives one GDAL path for the rasters: the file itself, or a VRT
// in dir over all of them.
func Mosaic(files []string, dir, name string) (string, error) {
	if len(files) == 1 {
		return files[0], nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	registerGDAL()
	target := filepath.Join(dir, name)
	ds, err := buildVRT(target, slices.Sorted(slices.Values(files)))
	if err != nil {
		return "", err
	}
	return target, ds.Close()
}

// SoilStem gives "phh2o_0-5cm" for ".../phh2o_0-5cm_mean.tif".
func SoilStem(file string) string {
	return strings.TrimSuffix(path.Base(file), "_mean.tif")
}

// writeTable writes a table and gives its artifact.
func writeTable(dir, name string, t *pio.Table, schema []pio.ColumnSpec) (string, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	target := filepath.Join(dir, name+".parquet")
	return target, pio.WriteParquet(target, t, schema)
}

// readColumns reads the float32 columns of a site part in file order and
// checks that its cells are the cells of the grid.
func readColumns(file string, g Grid) (Columns, error) {
	info, err := pio.Inspect(file)
	if err != nil {
		return Columns{}, err
	}
	t, err := pio.ReadParquet(file, nil)
	if err != nil {
		return Columns{}, err
	}
	cells := t.Str["cell"]
	if len(cells) != g.Len() {
		return Columns{}, fmt.Errorf("derive: %s has %d cells, the grid has %d", filepath.Base(file), len(cells), g.Len())
	}
	for i, c := range cells {
		if c != g.Key(i%g.NX(), i/g.NX()).String() {
			return Columns{}, fmt.Errorf("derive: %s has the cell %s in row %d, not the grid cell", filepath.Base(file), c, i)
		}
	}
	names := make([]string, 0, len(info.Columns))
	for _, c := range info.Columns {
		names = append(names, c.Name)
	}
	return ColumnsOf(t, names), nil
}

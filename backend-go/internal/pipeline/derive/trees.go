package derive

import (
	"context"
	"fmt"
	"strconv"

	"github.com/airbusgeo/godal"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// Constants of tile_trees in region_map.py.
const (
	// TreePixel is the step of the warped tree map in metres.
	TreePixel = 10
	// TreeTile is the edge of one warp tile in metres.
	TreeTile = 50_000
	// trainCell is the weather cell (COARSE_INPUTS["weather"]). forest_pixels
	// counts 10 m pixels of forest in a cell of this size.
	trainCell = 5_000
	// classSlots is max(CLASSES) + 1: the count of class numbers kept.
	classSlots = 18
)

// TreeClass is one class of the Thünen map and its column name.
type TreeClass struct {
	Value int
	Name  string
}

// TreeClasses are the classes of the published map legend, in the order of
// CLASSES in tree_species.py. Class 0 is ground without forest.
var TreeClasses = []TreeClass{
	{2, "birch"}, {3, "beech"}, {4, "douglas_fir"}, {5, "oak"}, {6, "alder"},
	{8, "spruce"}, {9, "pine"}, {10, "larch"}, {14, "fir"},
	{16, "deciduous_long_lived"}, {17, "deciduous_short_lived"},
}

// Conifers are the classes of the tree_conifer sum (CONIFERS).
var Conifers = []string{"douglas_fir", "spruce", "pine", "larch", "fir"}

// ShareNames gives the 13 share names: the classes, then conifer and broadleaf.
func ShareNames() []string {
	names := make([]string, 0, len(TreeClasses)+2)
	for _, c := range TreeClasses {
		names = append(names, c.Name)
	}
	return append(names, "conifer", "broadleaf")
}

// ClassCounts holds the 10 m pixel count of each class number in each cell
// of a grid, at index cell*classSlots + class. A cell has at most 2,500 pixels.
type ClassCounts struct {
	Grid   Grid
	Counts []uint16
}

// TreeOptions steers TileTrees. Tile is the edge of a warp tile in metres
// (TreeTile when 0). Progress gets the count of done tiles; it can be nil.
type TreeOptions struct {
	Tile     int
	Progress func(done, total int)
}

// TileTrees counts the classes of the tree map in each cell, as tile_trees:
// each tile of the grid is warped to EPSG:3035 at 10 m with the nearest
// neighbour and nodata 0, then each block of step/10 pixels is counted.
// The source is a local file in any CRS instead of the WCS of the Thünen
// service. An error in a tile stops the count; Python skips the tile.
func TileTrees(ctx context.Context, source string, g Grid, opt TreeOptions) (*ClassCounts, error) {
	if err := g.Check(); err != nil {
		return nil, err
	}
	tile := opt.Tile
	if tile == 0 {
		tile = TreeTile
	}
	if tile%g.Step != 0 || g.Step%TreePixel != 0 {
		return nil, fmt.Errorf("derive: tile %d m and step %d m do not fit the 10 m pixel", tile, g.Step)
	}
	src, err := openRaster(source)
	if err != nil {
		return nil, err
	}
	defer src.Close()
	out := &ClassCounts{Grid: g, Counts: make([]uint16, g.Len()*classSlots)}
	boxes := treeTiles(g, tile)
	for i, box := range boxes {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		band, nx, ny, err := warpTreeTile(src, box)
		if err != nil {
			return nil, err
		}
		out.add(band, nx, ny, box)
		if opt.Progress != nil {
			opt.Progress(i+1, len(boxes))
		}
	}
	return out, nil
}

// treeTiles lists the tile boxes, x first, then y, as tile_trees.
func treeTiles(g Grid, tile int) [][4]int {
	var out [][4]int
	for tx := g.X0; tx < g.X1; tx += tile {
		for ty := g.Y0; ty < g.Y1; ty += tile {
			out = append(out, [4]int{tx, ty, min(tx+tile, g.X1), min(ty+tile, g.Y1)})
		}
	}
	return out
}

// warpTreeTile warps one tile box of the source onto the 10 m grid, as the
// gdalwarp call of tile_trees.
func warpTreeTile(src *godal.Dataset, box [4]int) ([]uint8, int, int, error) {
	px := strconv.Itoa(TreePixel)
	switches := []string{"-t_srs", ModelCRS,
		"-te", itoa(box[0]), itoa(box[1]), itoa(box[2]), itoa(box[3]),
		"-tr", px, px, "-r", "near", "-dstnodata", "0"}
	ds, err := warpMem(src, switches)
	if err != nil {
		return nil, 0, 0, err
	}
	defer ds.Close()
	nx, ny := size(ds)
	band, err := readBytes(ds)
	return band, nx, ny, err
}

// add counts the classes of one warped tile into its cells.
func (c *ClassCounts) add(band []uint8, nx, ny int, box [4]int) {
	g := c.Grid
	side := g.Step / TreePixel
	col0 := (box[0] - g.X0) / g.Step
	row0 := (g.Y1 - box[3]) / g.Step
	for row := range ny / side {
		for col := range nx / side {
			gx, gy := col0+col, row0+row
			if gy < 0 || gy >= g.NY() || gx < 0 || gx >= g.NX() {
				continue
			}
			cell := c.Counts[(gy*g.NX()+gx)*classSlots:][:classSlots]
			for r := row * side; r < (row+1)*side; r++ {
				for _, v := range band[r*nx+col*side : r*nx+(col+1)*side] {
					if int(v) < classSlots {
						cell[v]++
					}
				}
			}
		}
	}
}

// TreesGridSchema is the column list of trees_de_500m.parquet.
func TreesGridSchema() []pio.ColumnSpec {
	specs := []pio.ColumnSpec{
		{Name: "gx", Type: pio.Int64}, {Name: "gy", Type: pio.Int64},
		{Name: "x", Type: pio.Float64}, {Name: "y", Type: pio.Float64},
		{Name: "forest_fraction", Type: pio.Float32}, {Name: "forest_pixels", Type: pio.Float32},
	}
	for _, name := range ShareNames() {
		specs = append(specs, pio.ColumnSpec{Name: "tree_" + name, Type: pio.Float32})
	}
	return append(specs, pio.ColumnSpec{Name: "cell", Type: pio.String})
}

// Table gives the trees grid of tile_trees and trees_germany.main: one row
// per cell, rows first. Each share is the count of the class over the
// forest count, in float32 as numpy; a cell without forest has 0.
func (c *ClassCounts) Table() *pio.Table {
	g := c.Grid
	n := g.Len()
	side2 := float32((g.Step / TreePixel) * (g.Step / TreePixel))
	perTrain := float32((trainCell / TreePixel) * (trainCell / TreePixel))
	t := pio.NewTable(n)
	gxs, gys := make([]int64, n), make([]int64, n)
	xs, ys := make([]float64, n), make([]float64, n)
	fraction, pixels := make([]float32, n), make([]float32, n)
	cells := make([]string, n)
	shares := make([][]float32, len(TreeClasses))
	for k := range shares {
		shares[k] = make([]float32, n)
	}
	for i := range n {
		gx, gy := i%g.NX(), i/g.NX()
		counts := c.Counts[i*classSlots:][:classSlots]
		var forest float32
		for _, v := range counts[1:] {
			forest += float32(v)
		}
		gxs[i], gys[i] = int64(gx), int64(gy)
		xs[i], ys[i] = g.Centre(gx, gy)
		fraction[i] = forest / side2
		pixels[i] = fraction[i] * perTrain
		cells[i] = g.Key(gx, gy).String()
		if forest > 0 {
			for k, cl := range TreeClasses {
				shares[k][i] = float32(counts[cl.Value]) / forest
			}
		}
	}
	t.I64["gx"], t.I64["gy"] = gxs, gys
	t.F64["x"], t.F64["y"] = xs, ys
	t.F32["forest_fraction"], t.F32["forest_pixels"] = fraction, pixels
	t.Str["cell"] = cells
	for k, cl := range TreeClasses {
		t.F32["tree_"+cl.Name] = shares[k]
	}
	t.F32["tree_conifer"], t.F32["tree_broadleaf"] = groupSums(t, n)
	return t
}

// groupSums adds the conifer and the broadleaf shares row by row, as the
// pandas sum(axis=1) in tile_trees: left to right in float32.
func groupSums(t *pio.Table, n int) (conifer, broadleaf []float32) {
	isConifer := map[string]bool{}
	for _, c := range Conifers {
		isConifer[c] = true
	}
	conifer, broadleaf = make([]float32, n), make([]float32, n)
	for i := range n {
		var c, b float32
		for _, cl := range TreeClasses {
			v := t.F32["tree_"+cl.Name][i]
			if isConifer[cl.Name] {
				c += v
			} else {
				b += v
			}
		}
		conifer[i], broadleaf[i] = c, b
	}
	return conifer, broadleaf
}

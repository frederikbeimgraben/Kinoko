package tiles

import (
	"math"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// The cases follow modell/tests/test_pyramid.py.

func codes(vals ...float64) []uint8 {
	out := make([]uint8, len(vals))
	for i, v := range vals {
		out[i] = geo.ToByte(float32(v))
	}
	return out
}

func near(t *testing.T, got float32, want, tol float64) {
	t.Helper()
	if math.Abs(float64(got)-want) > tol {
		t.Errorf("got %v, want %v ± %v", got, want, tol)
	}
}

func TestHalveMeanOfFour(t *testing.T) {
	fine := codes(0, 1, 1, 1)
	c, w := Halve(fine, FullWeight(fine), 2, 2)
	near(t, geo.FromByte(c[0]), 0.75, 1.0/254)
	near(t, geo.FromByte(w[0]), 1, 1e-6)
}

func TestHalveChildWithoutData(t *testing.T) {
	nan := math.NaN()
	fine := codes(nan, 1, nan, 0)
	c, w := Halve(fine, FullWeight(fine), 2, 2)
	near(t, geo.FromByte(c[0]), 0.5, 1.0/254)
	near(t, geo.FromByte(w[0]), 0.5, 1.0/254)
}

func TestHalveNoData(t *testing.T) {
	fine := make([]uint8, 4)
	c, w := Halve(fine, FullWeight(fine), 2, 2)
	if c[0] != 0 || w[0] != 0 {
		t.Fatalf("got %d, %d; want 0, 0", c[0], w[0])
	}
}

func TestHalveWeightCarriesMean(t *testing.T) {
	nan := math.NaN()
	fine := codes(1, 1, 0, nan, 1, 1, nan, nan, nan, nan, nan, nan, nan, nan, nan, nan)
	c1, w1 := Halve(fine, FullWeight(fine), 4, 4)
	c2, _ := Halve(c1, w1, 2, 2)
	near(t, geo.FromByte(c2[0]), 4.0/5.0, 2.0/254)
}

func TestCutSkipsEmptyTiles(t *testing.T) {
	nx, ny := 2*TileSize, TileSize+7
	code := make([]uint8, nx*ny)
	code[TileSize+3] = 9
	got := Cut(code, nx, ny, 9, 100, 200)
	if len(got) != 1 || got[0].ID != (geo.TileID{Z: 9, X: 101, Y: 200}) {
		t.Fatalf("got %+v", got)
	}
	if got[0].Tile.Code[3] != 9 || got[0].Tile.Weight[3] != 255 || got[0].Tile.Weight[0] != 0 {
		t.Fatal("tile bytes or weight are wrong")
	}
}

func TestWriteAndReadTile(t *testing.T) {
	root := t.TempDir()
	code := slices.Repeat(codes(0.25), TileSize*TileSize)
	ok, err := WriteTile(root, geo.TileID{Z: 14, X: 3, Y: 5}, code)
	if err != nil || !ok {
		t.Fatalf("write: %v %v", ok, err)
	}
	back, err := ReadTile(root, geo.TileID{Z: 14, X: 3, Y: 5})
	if err != nil || !slices.Equal(back, code) {
		t.Fatalf("read back differs: %v", err)
	}
	if missing, err := ReadTile(root, geo.TileID{Z: 14, X: 3, Y: 6}); missing != nil || err != nil {
		t.Fatal("a missing tile must give nil")
	}
	ok, _ = WriteTile(root, geo.TileID{Z: 13, X: 1, Y: 1}, make([]uint8, TileSize*TileSize))
	if _, err := os.Stat(filepath.Join(root, "13")); ok || err == nil {
		t.Fatal("an empty tile must not be written")
	}
}

func TestCoarsenBuildsLowerLevels(t *testing.T) {
	full := slices.Repeat(codes(1), TileSize*TileSize)
	store := MemStore{}
	for _, xy := range [][2]int{{8, 10}, {9, 10}, {8, 11}} {
		store[geo.TileID{Z: 12, X: xy[0], Y: xy[1]}] = Tile{Code: full, Weight: FullWeight(full)}
	}
	written, err := Coarsen(store, 12, 10)
	if err != nil {
		t.Fatal(err)
	}
	want := []geo.TileID{{Z: 11, X: 4, Y: 5}, {Z: 10, X: 2, Y: 2}}
	if !slices.Equal(written, want) {
		t.Fatalf("written %v, want %v", written, want)
	}
	parent := store[geo.TileID{Z: 11, X: 4, Y: 5}]
	near(t, geo.FromByte(parent.Code[0]), 1, 1e-6)
	if parent.Code[(TileSize-1)*TileSize+TileSize-1] != 0 {
		t.Fatal("the quarter of the missing child must have no data")
	}
}

func TestBlockGridAndFloorDiv(t *testing.T) {
	if floorDiv(-3, 2) != -2 || floorDiv(3, 2) != 1 || floorDiv(-4, 2) != -2 {
		t.Fatal("floorDiv is not Python //")
	}
	box := BlockBox(1, 2, 10, 4)
	want := geo.TileBox(4, 8, 7, 11, 10)
	if box != want {
		t.Fatalf("BlockBox %v, want %v", box, want)
	}
}

func TestCoverage(t *testing.T) {
	a := []geo.TileID{{Z: 9, X: 2, Y: 1}, {Z: 5, X: 1, Y: 1}}
	b := []geo.TileID{{Z: 9, X: 2, Y: 1}, {Z: 11, X: 4, Y: 2}}
	obj := SpeciesTiles([][]geo.TileID{a, b}, 5, 9)
	have, _ := obj.Get("have")
	if got := fmtHave(have); got != "5:[1/1] 9:[2/1] 11:[4/2]" {
		t.Fatalf("have %s", got)
	}
	entry := SetFineCoverage(geo.HaveList(nil), slices.Concat(a, b), 13, FineHaveZoom, FineOfflineZoomTo)
	if !slices.Equal(entry.Keys(), []string{"zooms", "haveZoom", "offlineZoomTo", "have"}) {
		t.Fatalf("keys %v", entry.Keys())
	}
	capped, _ := entry.Get("have")
	if got := fmtHave(capped); got != "5:[1/1] 9:[2/1 2/1]" {
		t.Fatalf("capped have %s", got)
	}
}

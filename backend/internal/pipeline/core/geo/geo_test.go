package geo

import (
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"math"
	"os"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

func f64(t *testing.T, s string) float64 {
	t.Helper()
	b, err := hex.DecodeString(s)
	if err != nil || len(b) != 8 {
		t.Fatalf("bad hex %q", s)
	}
	return math.Float64frombits(binary.BigEndian.Uint64(b))
}

func f32(t *testing.T, s string) float32 {
	t.Helper()
	b, err := hex.DecodeString(s)
	if err != nil || len(b) != 4 {
		t.Fatalf("bad hex %q", s)
	}
	return math.Float32frombits(binary.BigEndian.Uint32(b))
}

func readJSON(t *testing.T, path string, v any) {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, v); err != nil {
		t.Fatal(err)
	}
}

// laea.json is the golden file of the pyproj transform EPSG:4326 to
// EPSG:3035 and back, always_xy, on 1000 random points in DE.
func TestLAEAMatchesPyproj(t *testing.T) {
	var pts []struct{ Lon, Lat, X, Y, Ilon, Ilat string }
	readJSON(t, "testdata/laea.json", &pts)
	var worst, worstInv float64
	for _, p := range pts {
		x, y := LAEA3035(f64(t, p.Lon), f64(t, p.Lat))
		worst = max(worst, math.Hypot(x-f64(t, p.X), y-f64(t, p.Y)))
		lon, lat := InvLAEA3035(f64(t, p.X), f64(t, p.Y))
		worstInv = max(worstInv, math.Abs(lon-f64(t, p.Ilon)), math.Abs(lat-f64(t, p.Ilat)))
	}
	if worst > 1e-3 {
		t.Errorf("forward error %.3g m, want <= 1 mm", worst)
	}
	if worstInv > 1e-8 {
		t.Errorf("inverse error %.3g degrees, want <= 1e-8", worstInv)
	}
	t.Logf("forward error %.3g m, inverse error %.3g degrees", worst, worstInv)
	if x, y := LAEA3035(10, 52); x != laeaX0 || math.Abs(y-laeaY0) > 1e-9 {
		t.Errorf("origin goes to %v, %v", x, y)
	}
}

type tilesGolden struct {
	Mercator []struct{ Lon, Lat, X, Y string }
	Zooms    []struct {
		Res             float64
		Cap, Base, Zoom int
	}
	Ranges []struct {
		Box     [4]string
		Z       int
		Range   [4]int
		Tilebox [4]string
	}
	Bytes struct {
		Values []string
		Codes  []uint8
		From   []string
	}
	Have struct {
		Tiles [][3]int
		Have  json.RawMessage
		UpTo9 json.RawMessage
	}
	Cells []struct{ X, Y, Size, Cell, Np string }
}

// tiles.json is the golden file of the mercator transform, the finest zoom,
// the tile range and box, the byte coding, the "have" list and the floor
// division x // size.
func loadTiles(t *testing.T) tilesGolden {
	var g tilesGolden
	readJSON(t, "testdata/tiles.json", &g)
	return g
}

// Go math.Tan and math.Log differ from libm by a few ulps, so y gets a
// relative tolerance of 1e-14.
func TestMercatorMatchesGolden(t *testing.T) {
	for _, m := range loadTiles(t).Mercator {
		x, y := ToMercator(f64(t, m.Lon), f64(t, m.Lat))
		if x != f64(t, m.X) || math.Abs(y-f64(t, m.Y)) > 1e-14*math.Abs(y) {
			t.Errorf("ToMercator(%v, %v) = %v, %v; want %v, %v", f64(t, m.Lon), f64(t, m.Lat), x, y, f64(t, m.X), f64(t, m.Y))
		}
	}
}

func TestFinestZoomMatchesGolden(t *testing.T) {
	for _, z := range loadTiles(t).Zooms {
		cp, base := z.Cap, z.Base
		if cp == 0 {
			cp, base = ZoomCap, ZoomBase
		}
		if got := FinestZoom(z.Res, cp, base); got != z.Zoom {
			t.Errorf("FinestZoom(%v, %d, %d) = %d, want %d", z.Res, cp, base, got, z.Zoom)
		}
	}
	want := map[float64]int{10: 13, 90: 12, 250: 10, 500: 9, 2500: 7, 5000: 6, 25000: 5}
	for res, zoom := range want {
		if got := FinestZoom(res, ZoomCap, ZoomBase); got != zoom {
			t.Errorf("FinestZoom(%v) = %d, want %d", res, got, zoom)
		}
	}
}

func TestTileRangeAndBoxMatchGolden(t *testing.T) {
	for _, r := range loadTiles(t).Ranges {
		b := [4]float64{f64(t, r.Box[0]), f64(t, r.Box[1]), f64(t, r.Box[2]), f64(t, r.Box[3])}
		tx0, ty0, tx1, ty1 := TileRange(b[0], b[1], b[2], b[3], r.Z)
		if [4]int{tx0, ty0, tx1, ty1} != r.Range {
			t.Fatalf("TileRange(%v, %d) = %v, want %v", b, r.Z, [4]int{tx0, ty0, tx1, ty1}, r.Range)
		}
		box := TileBox(tx0, ty0, tx1, ty1, r.Z)
		for i := range box {
			if box[i] != f64(t, r.Tilebox[i]) {
				t.Fatalf("TileBox(%v, %d)[%d] = %v, want %v", r.Range, r.Z, i, box[i], f64(t, r.Tilebox[i]))
			}
		}
	}
}

func TestByteCodingMatchesGolden(t *testing.T) {
	g := loadTiles(t).Bytes
	for i, s := range g.Values {
		v := f32(t, s)
		if got := ToByte(v); got != g.Codes[i] {
			t.Errorf("ToByte(%v) = %d, want %d", v, got, g.Codes[i])
		}
	}
	for b, s := range g.From {
		want, got := f32(t, s), FromByte(uint8(b))
		if math.Float32bits(want) != math.Float32bits(got) && !(math.IsNaN(float64(want)) && math.IsNaN(float64(got))) {
			t.Errorf("FromByte(%d) = %v, want %v", b, got, want)
		}
	}
	if !slicesEqual(ToBytes([]float32{0, 1, float32(math.NaN())}), []uint8{1, 255, 0}) {
		t.Error("ToBytes")
	}
	if FromBytes([]uint8{1, 255})[1] != 1 {
		t.Error("FromBytes")
	}
}

func slicesEqual(a, b []uint8) bool { return string(a) == string(b) }

func TestHaveListMatchesGolden(t *testing.T) {
	g := loadTiles(t).Have
	tiles := make([]TileID, len(g.Tiles))
	for i, x := range g.Tiles {
		tiles[i] = TileID{Z: x[0], X: x[1], Y: x[2]}
	}
	check := func(name string, got *pyjson.Obj, want json.RawMessage) {
		if string(pyjson.MarshalCompact(got, true)) != compact(t, want) {
			t.Errorf("%s = %s, want %s", name, pyjson.MarshalCompact(got, true), want)
		}
	}
	check("HaveList", HaveList(tiles), g.Have)
	check("HaveUpTo", HaveUpTo(tiles, 9), g.UpTo9)
}

// compact removes the spaces that json.dumps puts after "," and ":".
// The golden have lists hold no space inside a string.
func compact(t *testing.T, raw json.RawMessage) string {
	out := make([]byte, 0, len(raw))
	for _, c := range raw {
		if c != ' ' && c != '\n' {
			out = append(out, c)
		}
	}
	return string(out)
}

func TestCellOfMatchesGolden(t *testing.T) {
	for _, c := range loadTiles(t).Cells {
		x, y, size := f64(t, c.X), f64(t, c.Y), f64(t, c.Size)
		got := CellOf(x, y, size)
		if got.String() != c.Cell {
			t.Errorf("CellOf(%v, %v, %v) = %v, want %s", x, y, size, got, c.Cell)
		}
		if math.Abs(x/size) < 1e9 && got.String() != c.Np {
			t.Errorf("CellOf(%v, %v, %v) = %v, numpy gives %s", x, y, size, got, c.Np)
		}
		if back, err := ParseCellKey(got.String()); err != nil || back != got {
			t.Errorf("ParseCellKey(%v) = %v, %v", got, back, err)
		}
	}
	for _, bad := range []string{"", "1", "1_", "_2", "a_b", "1_2_3"} {
		if _, err := ParseCellKey(bad); err == nil {
			t.Errorf("ParseCellKey(%q) gives no error", bad)
		}
	}
}

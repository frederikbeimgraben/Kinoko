package derive

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// goldenGrid is the golden file testdata/golden/grid.json.
type goldenGrid struct {
	Crop       [4]int     `json:"crop"`
	TreeTile   int        `json:"treeTile"`
	FineBox    [4]float64 `json:"fineBox"`
	Germany500 [4]int     `json:"germany500"`
}

func loadGrid(t *testing.T) goldenGrid {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("testdata", "golden", "grid.json"))
	if err != nil {
		t.Fatal(err)
	}
	var g goldenGrid
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatal(err)
	}
	return g
}

func (g goldenGrid) grid() Grid {
	return Grid{X0: g.Crop[0], Y0: g.Crop[1], X1: g.Crop[2], Y1: g.Crop[3], Step: CellStep}
}

func in(parts ...string) string {
	return filepath.Join(append([]string{"testdata", "in"}, parts...)...)
}

func golden(parts ...string) string {
	return filepath.Join(append([]string{"testdata", "golden"}, parts...)...)
}

func readGolden(t *testing.T, name string) (*pio.Table, pio.ParquetInfo) {
	t.Helper()
	info, err := pio.Inspect(golden(name))
	if err != nil {
		t.Fatal(err)
	}
	tab, err := pio.ReadParquet(golden(name), nil)
	if err != nil {
		t.Fatal(err)
	}
	return tab, info
}

// near tells if two float32 values agree within a relative and an absolute
// tolerance. Two NaN values agree.
func near(a, b float32, rel, abs float64) bool {
	x, y := float64(a), float64(b)
	if math.IsNaN(x) || math.IsNaN(y) {
		return math.IsNaN(x) && math.IsNaN(y)
	}
	return math.Abs(x-y) <= abs+rel*math.Abs(y)
}

// compareTable compares each column of the golden table with the Go table.
// tol gives the tolerance of a float column; a missing entry means exact.
func compareTable(t *testing.T, got *pio.Table, schema []pio.ColumnSpec, want *pio.Table, info pio.ParquetInfo,
	tol func(name string) (rel, abs float64)) {
	t.Helper()
	if got.N != want.N {
		t.Fatalf("rows: got %d, want %d", got.N, want.N)
	}
	if len(schema) != len(info.Columns) {
		t.Fatalf("columns: got %d, want %d", len(schema), len(info.Columns))
	}
	for i, spec := range info.Columns {
		if schema[i] != spec {
			t.Errorf("column %d: got %v, want %v", i, schema[i], spec)
			continue
		}
		name := spec.Name
		switch {
		case spec.Type == pio.String:
			for r := range want.N {
				if got.Str[name][r] != want.Str[name][r] {
					t.Fatalf("%s row %d: got %q, want %q", name, r, got.Str[name][r], want.Str[name][r])
				}
			}
		case spec.Type.IsInt():
			for r := range want.N {
				if got.I64[name][r] != want.I64[name][r] {
					t.Fatalf("%s row %d: got %d, want %d", name, r, got.I64[name][r], want.I64[name][r])
				}
			}
		case spec.Type == pio.Float64:
			for r := range want.N {
				if got.F64[name][r] != want.F64[name][r] {
					t.Fatalf("%s row %d: got %v, want %v", name, r, got.F64[name][r], want.F64[name][r])
				}
			}
		default:
			rel, abs := tol(name)
			bad := 0
			for r := range want.N {
				if !near(got.F32[name][r], want.F32[name][r], rel, abs) {
					if bad < 3 {
						t.Errorf("%s row %d: got %v, want %v", name, r, got.F32[name][r], want.F32[name][r])
					}
					bad++
				}
			}
			if bad > 0 {
				t.Errorf("%s: %d of %d rows differ", name, bad, want.N)
			}
		}
	}
}

func exact(string) (float64, float64) { return 0, 0 }

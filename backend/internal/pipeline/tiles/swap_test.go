package tiles

import (
	"errors"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// TestWritePyramidKeepsOldWeekOnFailedSwap checks that a failed rename of
// root.tmp leaves the live week in place.
func TestWritePyramidKeepsOldWeekOnFailedSwap(t *testing.T) {
	root := t.TempDir() + "/week"
	id := geo.TileID{Z: 6, X: 33, Y: 21}
	code := slices.Repeat(codes(0.5), TileSize*TileSize)
	pyr := Pyramid{Tiles: MemStore{id: {Code: code}}, Filled: []geo.TileID{id}}
	if _, err := WritePyramid(root, pyr); err != nil {
		t.Fatal(err)
	}
	renameDir = func(src, dst string) error {
		if strings.HasSuffix(src, ".tmp") {
			return errors.New("disk gone")
		}
		return os.Rename(src, dst)
	}
	t.Cleanup(func() { renameDir = os.Rename })
	if _, err := WritePyramid(root, pyr); err == nil {
		t.Fatal("the swap must fail")
	}
	if back, err := ReadTile(root, id); err != nil || !slices.Equal(back, code) {
		t.Fatalf("the live week is gone after a failed swap: %v", err)
	}
}

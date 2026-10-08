package tiles

import (
	"maps"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// Store holds the value and weight tiles of one pyramid during the build.
type Store interface {
	// At returns the tiles with data at one zoom.
	At(zoom int) ([]geo.TileID, error)
	// Get returns a tile, or nil when it has no file.
	Get(id geo.TileID) (*Tile, error)
	// Put keeps a tile that has data.
	Put(id geo.TileID, t Tile) error
}

// MemStore is a Store in memory. A week of a species at zoom 9 is a few
// hundred tiles, so the whole pyramid fits.
type MemStore map[geo.TileID]Tile

// At returns the tiles of one zoom.
func (m MemStore) At(zoom int) ([]geo.TileID, error) {
	var out []geo.TileID
	for id := range maps.Keys(m) {
		if id.Z == zoom {
			out = append(out, id)
		}
	}
	return out, nil
}

// Get returns a tile, or nil.
func (m MemStore) Get(id geo.TileID) (*Tile, error) {
	t, ok := m[id]
	if !ok {
		return nil, nil
	}
	return &t, nil
}

// Put keeps a tile.
func (m MemStore) Put(id geo.TileID, t Tile) error {
	m[id] = t
	return nil
}

type parentKey struct{ x, y int }

// Coarsen builds every level from finest-1 down to base, as pyramid.coarsen.
// Each parent of a tile with data is the weighted mean of its four children.
// It returns the parents with data, per zoom in the order (x, y).
func Coarsen(s Store, finest, base int) ([]geo.TileID, error) {
	var written []geo.TileID
	for zoom := finest; zoom > base; zoom-- {
		ids, err := s.At(zoom)
		if err != nil {
			return nil, err
		}
		for _, p := range parentsOf(ids) {
			made, err := coarsenOne(s, zoom, p)
			if err != nil {
				return nil, err
			}
			if made {
				written = append(written, geo.TileID{Z: zoom - 1, X: p.x, Y: p.y})
			}
		}
	}
	return written, nil
}

func parentsOf(ids []geo.TileID) []parentKey {
	set := map[parentKey]bool{}
	for _, id := range ids {
		set[parentKey{floorHalf(id.X), floorHalf(id.Y)}] = true
	}
	return slices.SortedFunc(maps.Keys(set), func(a, b parentKey) int {
		if a.x != b.x {
			return a.x - b.x
		}
		return a.y - b.y
	})
}

// floorHalf is Python x // 2.
func floorHalf(v int) int {
	if v < 0 {
		return -((-v + 1) / 2)
	}
	return v / 2
}

func coarsenOne(s Store, zoom int, p parentKey) (bool, error) {
	var children [4]*Tile
	for k := range children {
		child, err := s.Get(geo.TileID{Z: zoom, X: 2*p.x + k%2, Y: 2*p.y + k/2})
		if err != nil {
			return false, err
		}
		children[k] = child
	}
	parent := Parent(children)
	// A parent has value bytes exactly where it has weight bytes, so one test covers both trees.
	if !HasData(parent.Code) {
		return false, nil
	}
	return true, s.Put(geo.TileID{Z: zoom - 1, X: p.x, Y: p.y}, parent)
}

// Pyramid is the tile tree of one band. Filled lists the tiles with data in
// the order of render_field: the finest level as cut, then each coarser level.
type Pyramid struct {
	Tiles  MemStore
	Filled []geo.TileID
}

// BuildPyramid cuts a coded field at zoom from tile (tx0, ty0) and coarsens it down to base.
func BuildPyramid(code []uint8, nx, ny, zoom, tx0, ty0, base int) Pyramid {
	store := MemStore{}
	var filled []geo.TileID
	for _, p := range Cut(code, nx, ny, zoom, tx0, ty0) {
		store[p.ID] = p.Tile
		filled = append(filled, p.ID)
	}
	coarse, _ := Coarsen(store, zoom, base) // MemStore never fails.
	return Pyramid{Tiles: store, Filled: append(filled, coarse...)}
}

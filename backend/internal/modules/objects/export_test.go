package objects

import "github.com/frederikbeimgraben/kinoko/backend/internal/core/geo"

// FirstCell gives the tile and the pixel of the first cell under the ring.
// The API tests use it to write a value tile.
func FirstCell(ring geo.Ring, zoom int) (tileX, tileY int) {
	c := cellsUnder(ring, zoom)[0]
	return c.TileX, c.TileY
}

// TileSize is the edge of a value tile.
const TileSize = tileSize

package tiles

import (
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

// The "have" list of a fine layer stops at FineHaveZoom. Above it the app asks
// the coarser tile over the same place. The app stores tiles for offline use
// up to FineOfflineZoomTo.
const (
	FineHaveZoom      = 10
	FineOfflineZoomTo = 12
)

// Union returns each tile of the sets once, for example the tiles that the
// weeks of a species fill.
func Union(sets ...[]geo.TileID) []geo.TileID {
	seen := map[geo.TileID]bool{}
	var out []geo.TileID
	for _, id := range slices.Concat(sets...) {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

// SpeciesTiles returns the "tiles" object of a species manifest:
// {"zooms": [z0, z1], "have": the "have" list of the union of the weeks}.
// A frontend without haveZoom takes zooms[1], so the list is complete.
func SpeciesTiles(weeks [][]geo.TileID, z0, z1 int) *pyjson.Obj {
	return pyjson.O("zooms", []int{z0, z1}, "have", geo.HaveList(Union(weeks...)))
}

// SetFineCoverage puts the zoom keys of a fine layer into its layers.json
// entry, in this order: zooms, haveZoom,
// offlineZoomTo, have. The have list stops at haveZoom.
func SetFineCoverage(entry *pyjson.Obj, filled []geo.TileID, finest, haveZoom, offlineZoomTo int) *pyjson.Obj {
	return entry.
		Set("zooms", []int{geo.ZoomBase, finest}).
		Set("haveZoom", haveZoom).
		Set("offlineZoomTo", offlineZoomTo).
		Set("have", geo.HaveUpTo(filled, haveZoom))
}

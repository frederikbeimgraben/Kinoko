package fit

import (
	"cmp"
	"fmt"
	"os"
	"path/filepath"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
)

// FindsCellKm is cell_km of the finds layer: the edge of its grid in kilometres.
const FindsCellKm = 5

type cellWeek struct {
	cell string
	week int
}

// FindsLayer is the content of write_finds: the positive visits per 5 km cell and ISO week,
// on the cell centre in WGS84, rounded to 3 decimals. Rows are [lat, lon, week, n, years].
func FindsLayer(t *Table) (*pyjson.Obj, error) {
	n := map[cellWeek]int{}
	years := map[cellWeek]map[int]bool{}
	for i, y := range t.Label {
		if y != 1 {
			continue
		}
		k := cellWeek{t.Cell[i], t.ISOWeek[i]}
		n[k]++
		if years[k] == nil {
			years[k] = map[int]bool{}
		}
		years[k][t.ISOYear[i]] = true
	}
	keys := make([]cellWeek, 0, len(n))
	for k := range n {
		keys = append(keys, k)
	}
	slices.SortFunc(keys, func(a, b cellWeek) int { return cmp.Or(cmp.Compare(a.cell, b.cell), cmp.Compare(a.week, b.week)) })
	rows := make([]any, len(keys))
	for i, k := range keys {
		c, err := geo.ParseCellKey(k.cell)
		if err != nil {
			return nil, fmt.Errorf("fit: finds layer: %w", err)
		}
		lon, lat := geo.InvLAEA3035((float64(c.X)+0.5)*occ.CellSize, (float64(c.Y)+0.5)*occ.CellSize)
		rows[i] = []any{pyjson.Round(lat, 3), pyjson.Round(lon, 3), k.week, n[k], len(years[k])}
	}
	return pyjson.O("cell_km", FindsCellKm, "columns", []any{"lat", "lon", "week", "n", "years"}, "rows", rows), nil
}

// WriteFinds writes the finds layer to <dir>/<slug>.json with the separators (",", ":") of write_finds.
// Deviation: final_model.py names the file by the chain name; the catalogue slug is what readers look for (bug 1).
func WriteFinds(dir, slug string, t *Table) (string, error) {
	if slug == "" || filepath.Base(slug) != slug {
		return "", fmt.Errorf("fit: slug %q is not a plain file name", slug)
	}
	layer, err := FindsLayer(t)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(dir, slug+".json")
	return path, pyjson.WriteFileAtomic(path, pyjson.MarshalCompact(layer, true))
}

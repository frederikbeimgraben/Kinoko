package geo

import (
	"cmp"
	"fmt"
	"slices"
	"strconv"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

// TileID names one XYZ tile.
type TileID struct{ Z, X, Y int }

func compareTiles(a, b TileID) int {
	return cmp.Or(cmp.Compare(a.Z, b.Z), cmp.Compare(a.X, b.X), cmp.Compare(a.Y, b.Y))
}

// HaveList returns the "have" object of a manifest, as pyramid.belegung:
// per zoom, the tiles "x/y" in the order (z, x, y). Duplicates stay, as in Python.
func HaveList(tiles []TileID) *pyjson.Obj {
	sorted := slices.SortedFunc(slices.Values(tiles), compareTiles)
	return groupByZoom(sorted)
}

// HaveUpTo returns HaveList of the tiles with a zoom of cap or less, as pyramid.have_up_to.
func HaveUpTo(tiles []TileID, cap int) *pyjson.Obj {
	kept := slices.DeleteFunc(slices.Clone(tiles), func(t TileID) bool { return t.Z > cap })
	return HaveList(kept)
}

func groupByZoom(sorted []TileID) *pyjson.Obj {
	out := pyjson.NewObj()
	for _, t := range sorted {
		key := strconv.Itoa(t.Z)
		list, _ := out.Get(key)
		names, _ := list.([]string)
		out.Set(key, append(names, fmt.Sprintf("%d/%d", t.X, t.Y)))
	}
	return out
}

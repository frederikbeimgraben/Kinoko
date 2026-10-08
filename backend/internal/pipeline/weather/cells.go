package weather

import (
	"cmp"
	"fmt"
	"math"
	"slices"

	"github.com/airbusgeo/godal"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// PointTransform maps points from the soil CRS to the model CRS, x east and y north.
type PointTransform func(x, y []float64) (tx, ty []float64, err error)

// GDALTransform returns a PointTransform from EPSG src to EPSG dst through PROJ,
// as pyproj Transformer.from_crs(src, dst, always_xy=True).
func GDALTransform(src, dst int) (PointTransform, error) {
	from, err := godal.NewSpatialRefFromEPSG(src)
	if err != nil {
		return nil, fmt.Errorf("weather: EPSG:%d: %w", src, err)
	}
	to, err := godal.NewSpatialRefFromEPSG(dst)
	if err != nil {
		from.Close()
		return nil, fmt.Errorf("weather: EPSG:%d: %w", dst, err)
	}
	return func(x, y []float64) ([]float64, []float64, error) {
		tr, err := godal.NewTransform(from, to)
		if err != nil {
			return nil, nil, fmt.Errorf("weather: transform: %w", err)
		}
		defer tr.Close()
		tx, ty := slices.Clone(x), slices.Clone(y)
		ok := make([]bool, len(tx))
		// A failed point is set to Inf below; it then maps to no cell.
		_ = tr.TransformEx(tx, ty, make([]float64, len(tx)), ok)
		for i, good := range ok {
			if !good {
				tx[i], ty[i] = math.Inf(1), math.Inf(1)
			}
		}
		return tx, ty, nil
	}, nil
}

// pixelCells returns the cell of each pixel centre of the grid x by y, in
// meshgrid ravel order ([y][x]). A nil transform keeps the coordinates.
func pixelCells(x, y []float64, tr PointTransform) ([]geo.CellKey, []bool, error) {
	gx := make([]float64, 0, len(x)*len(y))
	gy := make([]float64, 0, len(x)*len(y))
	for _, yv := range y {
		for _, xv := range x {
			gx, gy = append(gx, xv), append(gy, yv)
		}
	}
	if tr != nil {
		var err error
		if gx, gy, err = tr(gx, gy); err != nil {
			return nil, nil, err
		}
	}
	keys := make([]geo.CellKey, len(gx))
	valid := make([]bool, len(gx))
	for i := range gx {
		// np.floor(x / CELL_SIZE), not x // CELL_SIZE: the two differ next to a cell edge.
		cx, cy := math.Floor(gx[i]/CellSize), math.Floor(gy[i]/CellSize)
		if math.Abs(cx) < math.MaxInt32 && math.Abs(cy) < math.MaxInt32 {
			keys[i], valid[i] = geo.CellKey{X: int32(cx), Y: int32(cy)}, true
		}
	}
	return keys, valid, nil
}

// landCells returns the distinct cells of the land pixels, sorted by (x, y) as np.unique.
func landCells(keys []geo.CellKey, valid, land []bool) []geo.CellKey {
	set := map[geo.CellKey]struct{}{}
	for i, k := range keys {
		if valid[i] && land[i] {
			set[k] = struct{}{}
		}
	}
	out := make([]geo.CellKey, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	slices.SortFunc(out, func(a, b geo.CellKey) int {
		return cmp.Or(cmp.Compare(a.X, b.X), cmp.Compare(a.Y, b.Y))
	})
	return out
}

// flatMap maps each pixel to the position of its cell in cells, or -1.
func flatMap(keys []geo.CellKey, valid []bool, lookup map[geo.CellKey]int32) []int32 {
	out := make([]int32, len(keys))
	for i, k := range keys {
		pos, ok := lookup[k]
		if !valid[i] || !ok {
			pos = -1
		}
		out[i] = pos
	}
	return out
}

func indexOf(cells []geo.CellKey) map[geo.CellKey]int32 {
	out := make(map[geo.CellKey]int32, len(cells))
	for i, c := range cells {
		out[c] = int32(i)
	}
	return out
}

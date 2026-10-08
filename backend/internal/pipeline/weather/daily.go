package weather

import (
	"fmt"
	"hash/fnv"
	"math"
	"sync"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// grid is the cell index of the run and a cache of pixel maps per file grid.
type grid struct {
	cells  []geo.CellKey
	lookup map[geo.CellKey]int32
	soil   PointTransform

	mu   sync.Mutex
	maps map[uint64][]int32
}

// pixelMap returns the pixel map of a file grid. extract_grids.py builds one map
// from the reference file of the year Start and builds a new map only when the
// size differs. Each map here comes from the coordinates of its own file; for equal grids that is the same map.
func (g *grid) pixelMap(x, y []float64, soil bool) ([]int32, error) {
	key := gridKey(x, y, soil)
	g.mu.Lock()
	m, ok := g.maps[key]
	g.mu.Unlock()
	if ok {
		return m, nil
	}
	var tr PointTransform
	if soil {
		tr = g.soil
	}
	keys, valid, err := pixelCells(x, y, tr)
	if err != nil {
		return nil, err
	}
	m = flatMap(keys, valid, g.lookup)
	g.mu.Lock()
	g.maps[key] = m
	g.mu.Unlock()
	return m, nil
}

func gridKey(x, y []float64, soil bool) uint64 {
	h := fnv.New64a()
	buf := make([]byte, 8)
	put := func(v float64) {
		b := math.Float64bits(v)
		for i := range buf {
			buf[i] = byte(b >> (8 * i))
		}
		h.Write(buf)
	}
	put(float64(len(x)))
	for _, v := range x {
		put(v)
	}
	for _, v := range y {
		put(v)
	}
	if soil {
		put(1)
	}
	return h.Sum64()
}

// dailyCellMeans reads one year file and returns the mean of the finite pixels
// of each cell for each day, [day][cell], and the days (daily_cell_means).
func (g *grid) dailyCellMeans(path, v string, soil bool) ([]float32, []time.Time, error) {
	f, err := pio.OpenNC(path)
	if err != nil {
		return nil, nil, err
	}
	defer func() { _ = f.Close() }()
	x, y, days, err := f.Coords()
	if err != nil {
		return nil, nil, err
	}
	mapping, err := g.pixelMap(x, y, soil)
	if err != nil {
		return nil, nil, err
	}
	packing, err := f.Packing(v)
	if err != nil {
		return nil, nil, err
	}
	nPix, nCells, nDays := len(x)*len(y), len(g.cells), len(days)
	out := make([]float32, nDays*nCells)
	sums := make([]float64, nCells)
	counts := make([]int64, nCells)
	block := make([]float64, Block*nPix)
	block32 := make([]float32, Block*nPix)
	for begin := 0; begin < nDays; begin += Block {
		n := min(Block, nDays-begin)
		// xarray gives float64 for a wide packing; bincount then sums those values without a float32 step.
		if packing.Wide {
			err = f.ReadDays64(v, begin, n, block[:n*nPix])
		} else if err = f.ReadDays(v, begin, n, block32[:n*nPix]); err == nil {
			for i, b := range block32[:n*nPix] {
				block[i] = float64(b)
			}
		}
		if err != nil {
			return nil, nil, fmt.Errorf("weather: %s: %w", path, err)
		}
		for d := range n {
			clear(sums)
			clear(counts)
			for p, pos := range mapping {
				val := block[d*nPix+p]
				if pos >= 0 && !math.IsNaN(val) && !math.IsInf(val, 0) {
					sums[pos] += val
					counts[pos]++
				}
			}
			row := out[(begin+d)*nCells : (begin+d+1)*nCells]
			for c := range row {
				row[c] = nan32
				if counts[c] > 0 {
					row[c] = float32(sums[c] / float64(counts[c]))
				}
			}
		}
	}
	return out, days, nil
}

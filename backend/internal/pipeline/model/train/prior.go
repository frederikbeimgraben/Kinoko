package train

import (
	"maps"
	"math"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
)

// Rows holds the visit columns that the prior needs, one value per visit.
type Rows struct {
	Cell  []string
	Block []string
	Year  []int
	Label []int8
}

// PriorColumns holds the four prior columns of PriorNames. A row outside the fold is NaN.
type PriorColumns struct {
	RateCell  []float32
	NCell     []float32
	RateBlock []float32
	NBlock    []float32
}

// Column returns the column with a name of PriorNames.
func (p PriorColumns) Column(name string) ([]float32, bool) {
	switch name {
	case "prior_rate_cell":
		return p.RateCell, true
	case "prior_n_cell":
		return p.NCell, true
	case "prior_rate_block":
		return p.RateBlock, true
	case "prior_n_block":
		return p.NBlock, true
	}
	return nil, false
}

type count struct{ n, pos int }

type yearKey struct {
	key  string
	year int
}

// Prior gives the prior of the training rows and the test rows of one fold.
// A training row reads the totals of the training rows without its own year (leave-year-out).
// A test row reads the totals of all training rows. A rate without rows is NaN.
func Prior(r Rows, train, test []int) PriorColumns {
	cellRate, cellN := priorOf(r.Cell, r, train, test)
	blockRate, blockN := priorOf(r.Block, r, train, test)
	return PriorColumns{cellRate, cellN, blockRate, blockN}
}

func priorOf(keys []string, r Rows, train, test []int) (rate, n []float32) {
	rate, n = nanColumn(len(keys)), nanColumn(len(keys))
	total := map[string]count{}
	own := map[yearKey]count{}
	for _, i := range train {
		total[keys[i]] = add(total[keys[i]], r.Label[i])
		k := yearKey{keys[i], r.Year[i]}
		own[k] = add(own[k], r.Label[i])
	}
	for _, i := range train {
		t, o := total[keys[i]], own[yearKey{keys[i], r.Year[i]}]
		rate[i], n[i] = rateOf(t.n-o.n, t.pos-o.pos)
	}
	for _, i := range test {
		t := total[keys[i]]
		rate[i], n[i] = rateOf(t.n, t.pos)
	}
	return rate, n
}

func add(c count, label int8) count { return count{c.n + 1, c.pos + int(label)} }

// rateOf computes the rate in float64 and stores it as float32.
func rateOf(n, pos int) (float32, float32) {
	if n <= 0 {
		return float32(math.NaN()), float32(n)
	}
	return float32(float64(pos) / float64(n)), float32(n)
}

func nanColumn(n int) []float32 {
	out := make([]float32, n)
	for i := range out {
		out[i] = float32(math.NaN())
	}
	return out
}

// PriorTables gives the rate and count of each cell and each block over rows.
// The keys are in lexical order, as a pandas groupby on a string column sorts them.
func PriorTables(r Rows, rows []int) bundle.Prior {
	return bundle.Prior{Cell: priorTable(r.Cell, r.Label, rows), Block: priorTable(r.Block, r.Label, rows)}
}

func priorTable(keys []string, label []int8, rows []int) bundle.PriorTable {
	counts := map[string]count{}
	for _, i := range rows {
		counts[keys[i]] = add(counts[keys[i]], label[i])
	}
	sorted := slices.Sorted(maps.Keys(counts))
	out := bundle.PriorTable{Keys: sorted, Rate: make(bundle.NullFloats, len(sorted)), N: make([]float64, len(sorted))}
	for i, k := range sorted {
		c := counts[k]
		out.Rate[i] = float64(c.pos) / float64(c.n)
		out.N[i] = float64(c.n)
	}
	return out
}

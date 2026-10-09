package fit

import (
	"fmt"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/horizons"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/train"
)

// FeatureList gives the knowable columns of the detection, season, weather
// and trees blocks, then the activity columns of horizon h, then the prior columns.
func FeatureList(b Blocks, t *Table, h int) ([]string, error) {
	var names []string
	for _, block := range [][]string{b.Detection, b.Season, b.Weather, b.Trees} {
		for _, c := range block {
			if _, ok := t.Columns[c]; ok && horizons.Knowable(c, h) {
				names = append(names, c)
			}
		}
	}
	activity := horizons.ActivityNames(h)
	for _, c := range activity {
		if _, ok := t.Columns[c]; !ok {
			return nil, fmt.Errorf("fit: the table lacks the activity columns for horizon %d", h)
		}
	}
	return slices.Concat(names, activity, train.PriorNames), nil
}

// Design gives the design matrix of the given rows: a row-major matrix with the columns in the
// order of features. A prior column comes from prior, every other column from the table.
func (t *Table) Design(features []string, prior train.PriorColumns, rows []int) ([]float64, error) {
	cols := make([]func(i int) float64, len(features))
	for j, name := range features {
		if p, ok := prior.Column(name); ok {
			cols[j] = func(i int) float64 { return float64(p[i]) }
			continue
		}
		c, ok := t.Columns[name]
		if !ok {
			return nil, fmt.Errorf("fit: the table has no column %s", name)
		}
		cols[j] = func(i int) float64 { return c[i] }
	}
	out := make([]float64, 0, len(rows)*len(features))
	for _, i := range rows {
		for _, col := range cols {
			out = append(out, col(i))
		}
	}
	return out, nil
}

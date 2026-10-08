package train

import (
	"cmp"
	"slices"
)

// Ranking is the feature order of the ranker model, by gain in descending order.
type Ranking struct {
	Order  []string
	Earned []string
	Total  float64
}

// Rank sorts the features by gain, descending, with a stable sort as Python's sorted.
// Earned keeps the features with a gain of MinGain times the total or more.
func Rank(names []string, gains []float64) Ranking {
	idx := make([]int, len(names))
	for i := range idx {
		idx[i] = i
	}
	slices.SortStableFunc(idx, func(a, b int) int { return cmp.Compare(-gains[a], -gains[b]) })
	order := make([]string, len(idx))
	total := 0.0
	// Python sums numpy float64 values one by one, without the compensated sum of plain floats.
	for i, j := range idx {
		order[i] = names[j]
		total += gains[j]
	}
	var earned []string
	for _, j := range idx {
		if gains[j] >= MinGain*total {
			earned = append(earned, names[j])
		}
	}
	return Ranking{order, earned, total}
}

// Candidates returns the feature lists that the pruning scores, shortest first:
// the prefixes of Sizes shorter than nFeatures, the earned list and the full order. The sort is stable.
func Candidates(r Ranking, nFeatures int) [][]string {
	var out [][]string
	for _, s := range Sizes {
		if s < nFeatures {
			out = append(out, r.Order[:min(s, len(r.Order))])
		}
	}
	out = append(out, r.Earned, r.Order)
	slices.SortStableFunc(out, func(a, b []string) int { return cmp.Compare(len(a), len(b)) })
	return out
}

// ChooseList returns the index of the first candidate whose score is within Tolerance of the best.
// The candidates are in the order of Candidates, so this is the shortest such list.
func ChooseList(scores []float64) int {
	top := slices.Max(scores)
	return slices.IndexFunc(scores, func(s float64) bool { return s >= top-Tolerance })
}

// PickSetting returns the index of the grid setting with the strictly highest score.
// The first maximum wins. Index 0 stays when no score is above -1, as in final_model.py.
func PickSetting(scores []float64) int {
	best, bestScore := 0, -1.0
	for i, s := range scores {
		if s > bestScore {
			best, bestScore = i, s
		}
	}
	return best
}

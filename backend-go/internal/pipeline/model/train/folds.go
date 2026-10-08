package train

import (
	"math"
	"slices"
	"strconv"
)

// Fold is one split of the row indices into training rows and test rows, both in ascending order.
type Fold struct {
	Train []int
	Test  []int
}

// FloorDiv is Python's float floor division a // b, which differs from math.Floor(a/b) near an integer.
func FloorDiv(a, b float64) float64 {
	mod := math.Mod(a, b)
	div := (a - mod) / b
	if mod != 0 && (b < 0) != (mod < 0) {
		div -= 1.0
	}
	if div == 0 {
		return math.Copysign(0, a/b)
	}
	floor := math.Floor(div)
	if div-floor > 0.5 {
		floor += 1.0
	}
	return floor
}

// BlockKey is block_key of final_model.py: "<x // BlockM>_<y // BlockM>".
func BlockKey(x, y float64) string {
	return strconv.Itoa(int(FloorDiv(x, BlockM))) + "_" + strconv.Itoa(int(FloorDiv(y, BlockM)))
}

// YearKeys returns the fold key of the year scheme: the ISO year.
func YearKeys(isoYear []int) []int64 {
	out := make([]int64, len(isoYear))
	for i, y := range isoYear {
		out[i] = int64(y)
	}
	return out
}

// SpaceKeys returns the fold key of the space scheme: x // 100 km.
func SpaceKeys(x []float64) []int64 {
	out := make([]int64, len(x))
	for i, v := range x {
		out[i] = int64(FloorDiv(v, SpaceM))
	}
	return out
}

// BlockedFolds is blocked_folds of final_model.py. Each distinct key, in ascending order, is the test part
// of one fold. A fold stays only if its test part has MinFoldRows rows and MinFoldPositives positives.
func BlockedFolds(key []int64, label []int8) []Fold {
	groups := slices.Compact(slices.Sorted(slices.Values(key)))
	var out []Fold
	for _, g := range groups {
		var fold Fold
		positives := 0
		for i, k := range key {
			if k == g {
				fold.Test = append(fold.Test, i)
				positives += int(label[i])
			} else {
				fold.Train = append(fold.Train, i)
			}
		}
		if len(fold.Test) >= MinFoldRows && positives >= MinFoldPositives {
			out = append(out, fold)
		}
	}
	return out
}

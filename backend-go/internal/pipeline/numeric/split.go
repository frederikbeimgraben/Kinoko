package numeric

import (
	"fmt"
	"math"
	"slices"
)

// StratifiedSplit is sklearn train_test_split(idx, test_size=testSize,
// random_state=seed, stratify=y) for one split. It returns idx[train], idx[test]
// in the order of StratifiedShuffleSplit.
func StratifiedSplit(idx []int, y []int8, testSize float64, seed uint32) (train, test []int, err error) {
	n := len(idx)
	if len(y) != n {
		return nil, nil, fmt.Errorf("numeric: %d labels for %d rows", len(y), n)
	}
	nTest := int(math.Ceil(testSize * float64(n)))
	nTrain := n - nTest
	classes := slices.Compact(slices.Sorted(slices.Values(y)))
	members := make([][]int, len(classes))
	for pos, label := range y {
		c, _ := slices.BinarySearch(classes, label)
		members[c] = append(members[c], pos)
	}
	counts := make([]int, len(classes))
	for c, m := range members {
		counts[c] = len(m)
	}
	switch {
	case slices.Min(counts) < 2:
		return nil, nil, fmt.Errorf("numeric: the least populated class has fewer than 2 members")
	case nTrain < len(classes) || nTest < len(classes):
		return nil, nil, fmt.Errorf("numeric: split sizes %d/%d are smaller than %d classes", nTrain, nTest, len(classes))
	}
	rng := NewRandomState(seed)
	nI := approximateMode(counts, nTrain, rng)
	left := make([]int, len(counts))
	for c := range counts {
		left[c] = counts[c] - nI[c]
	}
	tI := approximateMode(left, nTest, rng)
	var trainPos, testPos []int
	for c, m := range members {
		perm := rng.Permutation(counts[c])
		picked := make([]int, len(perm))
		for k, p := range perm {
			picked[k] = m[p]
		}
		trainPos = append(trainPos, picked[:nI[c]]...)
		testPos = append(testPos, picked[nI[c]:nI[c]+tI[c]]...)
	}
	pick := func(pos []int) []int {
		out := make([]int, len(pos))
		for k, p := range pos {
			out[k] = idx[p]
		}
		return out
	}
	return pick(rng.PermuteInts(trainPos)), pick(rng.PermuteInts(testPos)), nil
}

// approximateMode is sklearn _approximate_mode: the floor of the expected
// draws per class, then the rest to the largest remainders, ties at random.
func approximateMode(counts []int, draws int, rng *RandomState) []int {
	total := 0
	for _, c := range counts {
		total += c
	}
	cont := make([]float64, len(counts))
	floored := make([]float64, len(counts))
	for i, c := range counts {
		cont[i] = float64(c) / float64(total) * float64(draws)
		floored[i] = math.Floor(cont[i])
	}
	need := int(float64(draws) - Sum(floored))
	if need > 0 {
		rem := make([]float64, len(counts))
		for i := range rem {
			rem[i] = cont[i] - floored[i]
		}
		values := slices.Compact(slices.Sorted(slices.Values(rem)))
		slices.Reverse(values)
		for _, v := range values {
			var inds []int
			for i, r := range rem {
				if r == v {
					inds = append(inds, i)
				}
			}
			now := min(len(inds), need)
			for _, k := range rng.Permutation(len(inds))[:now] {
				floored[inds[k]]++
			}
			need -= now
			if need == 0 {
				break
			}
		}
	}
	out := make([]int, len(floored))
	for i, f := range floored {
		out[i] = int(f)
	}
	return out
}

// Fold is one blocked fold: the rows of one key are the test part.
type Fold struct {
	Key         int64
	Train, Test []int
}

const (
	// FoldMinRows is the least number of test rows of a kept fold.
	FoldMinRows = 100
	// FoldMinPositives is the least number of test positives of a kept fold.
	FoldMinPositives = 10
)

// BlockedFolds is final_model.blocked_folds: one fold per sorted distinct
// key, kept when its test part has FoldMinRows rows and FoldMinPositives positives.
func BlockedFolds(keys []int64, y []int8) []Fold {
	var folds []Fold
	for _, g := range slices.Compact(slices.Sorted(slices.Values(keys))) {
		f := Fold{Key: g}
		pos := 0
		for i, k := range keys {
			if k == g {
				f.Test = append(f.Test, i)
				pos += int(y[i])
			} else {
				f.Train = append(f.Train, i)
			}
		}
		if len(f.Test) >= FoldMinRows && pos >= FoldMinPositives {
			folds = append(folds, f)
		}
	}
	return folds
}

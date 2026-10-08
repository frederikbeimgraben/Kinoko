package train

import (
	"cmp"
	"math"
	"slices"
)

// Scorer is a metric of a binary label and a score, for example sklearn roc_auc_score.
type Scorer func(label []int8, p []float64) float64

// FitPredict trains on the training rows of a fold and returns a score for each test row, in the order of fold.Test.
type FitPredict func(fold Fold) ([]float64, error)

// Evaluate is evaluate of final_model.py: the mean AUC and mean AP over the folds.
// A fold whose test part has one class only is left out. With no fold left, both means are NaN, as np.mean.
func Evaluate(label []int8, folds []Fold, fit FitPredict, auc, ap Scorer) (meanAUC, meanAP float64, err error) {
	var aucs, aps []float64
	for _, fold := range folds {
		p, err := fit(fold)
		if err != nil {
			return math.NaN(), math.NaN(), err
		}
		y := pick(label, fold.Test)
		if positives := sumInt8(y); positives > 0 && positives < len(y) {
			aucs = append(aucs, auc(y, p))
			aps = append(aps, ap(y, p))
		}
	}
	return Mean(aucs), Mean(aps), nil
}

func pick[T any](v []T, idx []int) []T {
	out := make([]T, len(idx))
	for i, j := range idx {
		out[i] = v[j]
	}
	return out
}

func sumInt8(v []int8) int {
	total := 0
	for _, x := range v {
		total += int(x)
	}
	return total
}

// Ceiling is the cap of fit_calibrated: the mean label of the top max(30, int(0.02*n)) calibration rows by raw score.
// Ties of raw are ordered by descending index: the reverse of a stable ascending argsort.
// numpy's default argsort is not stable and depends on the CPU, so no port can copy its tie order.
func Ceiling(raw []float64, label []int8) float64 {
	order := make([]int, len(raw))
	for i := range order {
		order[i] = i
	}
	slices.SortStableFunc(order, func(a, b int) int { return cmp.Compare(raw[a], raw[b]) })
	slices.Reverse(order)
	support := min(max(CeilingRows, int(CeilingShare*float64(len(order)))), len(order))
	top := make([]float64, support)
	for i, j := range order[:support] {
		top[i] = float64(label[j])
	}
	return Mean(top)
}

// Brier is sklearn brier_score_loss: the mean squared difference of score and label.
func Brier(label []int8, p []float64) float64 {
	sq := make([]float64, len(p))
	for i := range p {
		d := float64(label[i]) - p[i]
		sq[i] = d * d
	}
	return Mean(sq)
}

// OOFScores are the out-of-fold scores that final_model.py prints for each horizon.
type OOFScores struct {
	Rows            int
	BrierRaw        float64
	BrierCalibrated float64
	AUC             float64
}

// OOF scores the rows with a finite calibrated value. raw and cal are NaN outside the test parts of the folds.
func OOF(label []int8, raw, cal []float64, auc Scorer) OOFScores {
	var good []int
	for i, c := range cal {
		if !math.IsNaN(c) && !math.IsInf(c, 0) {
			good = append(good, i)
		}
	}
	y, r, c := pick(label, good), pick(raw, good), pick(cal, good)
	return OOFScores{len(good), Brier(y, r), Brier(y, c), auc(y, c)}
}

// Mean is np.mean of float64 values: the pairwise sum of numpy, divided by n. It is NaN for no values.
func Mean(v []float64) float64 {
	if len(v) == 0 {
		return math.NaN()
	}
	return PairwiseSum(v) / float64(len(v))
}

// PairwiseSum ports numpy's pairwise_sum for a contiguous float64 array, so a mean matches numpy to the last bit.
func PairwiseSum(a []float64) float64 {
	const block = 128
	n := len(a)
	switch {
	case n < 8:
		res := 0.0
		for _, x := range a {
			res += x
		}
		return res
	case n <= block:
		var r [8]float64
		copy(r[:], a[:8])
		i := 8
		for ; i < n-n%8; i += 8 {
			for j := range r {
				r[j] += a[i+j]
			}
		}
		res := ((r[0] + r[1]) + (r[2] + r[3])) + ((r[4] + r[5]) + (r[6] + r[7]))
		for ; i < n; i++ {
			res += a[i]
		}
		return res
	default:
		n2 := n / 2
		n2 -= n2 % 8
		return PairwiseSum(a[:n2]) + PairwiseSum(a[n2:])
	}
}

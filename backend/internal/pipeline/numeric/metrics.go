package numeric

import (
	"cmp"
	"math"
	"slices"
)

// thresholdCounts is sklearn confusion_matrix_at_thresholds without weights:
// the false and true positive counts at each distinct score, descending.
func thresholdCounts(y []int8, p []float64) (fps, tps []float64) {
	order := make([]int, len(p))
	for i := range order {
		order[i] = i
	}
	slices.SortStableFunc(order, func(a, b int) int { return cmp.Compare(p[b], p[a]) })
	cum := 0.0
	for k, i := range order {
		if y[i] == 1 {
			cum += 1
		}
		if k == len(order)-1 || p[order[k+1]] != p[i] {
			tps = append(tps, cum)
			fps = append(fps, 1+float64(k)-cum)
		}
	}
	return fps, tps
}

// bothClasses tells if y holds a 0 and a 1.
func bothClasses(y []int8) bool {
	return slices.Contains(y, 0) && slices.Contains(y, 1)
}

// RocAUC is sklearn roc_auc_score for labels 0/1. It drops the collinear
// points as roc_curve does and integrates with the trapezoid rule.
// It returns NaN when y holds only one class.
func RocAUC(y []int8, p []float64) float64 {
	if !bothClasses(y) {
		return math.NaN()
	}
	fps, tps := thresholdCounts(y, p)
	if len(fps) > 2 {
		var kf, kt []float64
		for i := range fps {
			corner := i == 0 || i == len(fps)-1 ||
				(fps[i+1]-fps[i])-(fps[i]-fps[i-1]) != 0 ||
				(tps[i+1]-tps[i])-(tps[i]-tps[i-1]) != 0
			if corner {
				kf, kt = append(kf, fps[i]), append(kt, tps[i])
			}
		}
		fps, tps = kf, kt
	}
	fps = append([]float64{0}, fps...)
	tps = append([]float64{0}, tps...)
	nf, nt := fps[len(fps)-1], tps[len(tps)-1]
	terms := make([]float64, len(fps)-1)
	for i := range terms {
		d := fps[i+1]/nf - fps[i]/nf
		terms[i] = d * (tps[i+1]/nt + tps[i]/nt) / 2.0
	}
	return Sum(terms)
}

// AveragePrecision is sklearn average_precision_score for labels 0/1: the
// step integral of precision over recall, at least 0.
func AveragePrecision(y []int8, p []float64) float64 {
	fps, tps := thresholdCounts(y, p)
	m := len(tps)
	last := tps[m-1]
	precision := make([]float64, m)
	recall := make([]float64, m)
	for i := range m {
		precision[i] = tps[i] / (tps[i] + fps[i])
		recall[i] = 1
		if last != 0 {
			recall[i] = tps[i] / last
		}
	}
	// sklearn integrates over the reversed curves, so the sum runs in that order.
	slices.Reverse(precision)
	slices.Reverse(recall)
	recall = append(recall, 0)
	terms := make([]float64, m)
	for k := range m {
		terms[k] = (recall[k+1] - recall[k]) * precision[k]
	}
	return max(0, -Sum(terms))
}

// Brier is sklearn brier_score_loss for labels 0/1: the two-column squared
// error, averaged, times 0.5, as sklearn 1.8 computes it.
func Brier(y []int8, p []float64) float64 {
	rows := make([]float64, len(p))
	for i, v := range p {
		t := float64(y[i])
		a := (1 - t) - (1 - v)
		b := t - v
		rows[i] = float64(a*a) + float64(b*b)
	}
	return Mean(rows) * 0.5
}

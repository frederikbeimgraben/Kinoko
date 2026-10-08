// Package numeric holds the numeric kernels of the pipeline: filters,
// sampling, isotonic regression, metrics, splits and the numpy random state.
// Each function copies the order of operations of numpy, scipy or sklearn,
// so that the Go results match the Python chain to the last bits where possible.
package numeric

// Float is the set of storage types the kernels accept.
type Float interface{ ~float32 | ~float64 }

// pairwiseBlock is PW_BLOCKSIZE of numpy.
const pairwiseBlock = 128

// Sum returns np.sum of a in the type of a. numpy starts the reduction with
// a[0] and adds the pairwise sum of the rest, so the rounding equals np.sum.
func Sum[T Float](a []T) T {
	if len(a) == 0 {
		return 0
	}
	return a[0] + pairwise(a[1:])
}

// Mean returns np.mean of a float64 slice: np.sum divided by the count.
func Mean(a []float64) float64 {
	return Sum(a) / float64(len(a))
}

// pairwise is pairwise_sum of numpy loops_utils: eight accumulators for a
// block, a split in two halves above the block size.
func pairwise[T Float](a []T) T {
	n := len(a)
	switch {
	case n < 8:
		var res T
		for _, v := range a {
			res += v
		}
		return res
	case n <= pairwiseBlock:
		var r [8]T
		copy(r[:], a[:8])
		i := 8
		for ; i < n-n%8; i += 8 {
			for j := range 8 {
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
		return pairwise(a[:n2]) + pairwise(a[n2:])
	}
}

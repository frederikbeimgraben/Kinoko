package numeric

// mtN is the state length of MT19937.
const mtN = 624

// RandomState is the legacy numpy.random.RandomState: MT19937 with the
// init_genrand seed and the shuffle of mtrand.pyx. sklearn uses it for
// random_state=int.
type RandomState struct {
	mt  [mtN]uint32
	pos int
}

// NewRandomState is np.random.RandomState(seed).
func NewRandomState(seed uint32) *RandomState {
	r := &RandomState{pos: mtN}
	r.mt[0] = seed
	for i := 1; i < mtN; i++ {
		prev := r.mt[i-1]
		r.mt[i] = 1812433253*(prev^(prev>>30)) + uint32(i)
	}
	return r
}

// generate refills the state (mt19937_gen of numpy).
func (r *RandomState) generate() {
	const m = 397
	const upper, lower = 0x80000000, 0x7fffffff
	const matrix = 0x9908b0df
	for i := range mtN {
		y := (r.mt[i] & upper) | (r.mt[(i+1)%mtN] & lower)
		v := r.mt[(i+m)%mtN] ^ (y >> 1)
		if y&1 != 0 {
			v ^= matrix
		}
		r.mt[i] = v
	}
	r.pos = 0
}

// Uint32 returns the next tempered 32-bit output.
func (r *RandomState) Uint32() uint32 {
	if r.pos >= mtN {
		r.generate()
	}
	y := r.mt[r.pos]
	r.pos++
	y ^= y >> 11
	y ^= (y << 7) & 0x9d2c5680
	y ^= (y << 15) & 0xefc60000
	y ^= y >> 18
	return y
}

// interval is random_interval of numpy: a masked draw in [0, hi], redrawn
// while it is above hi. The 32-bit path covers every slice length in Go.
func (r *RandomState) interval(hi uint32) uint32 {
	if hi == 0 {
		return 0
	}
	mask := hi
	for s := uint(1); s <= 16; s <<= 1 {
		mask |= mask >> s
	}
	for {
		if v := r.Uint32() & mask; v <= hi {
			return v
		}
	}
}

// shuffle is the legacy in-place Fisher-Yates shuffle of RandomState.shuffle.
func shuffle[T any](r *RandomState, a []T) {
	for i := len(a) - 1; i >= 1; i-- {
		j := r.interval(uint32(i))
		a[i], a[j] = a[j], a[i]
	}
}

// Permutation is RandomState.permutation(n).
func (r *RandomState) Permutation(n int) []int {
	out := make([]int, n)
	for i := range out {
		out[i] = i
	}
	shuffle(r, out)
	return out
}

// PermuteInts is RandomState.permutation(a) for a 1-D integer array. It
// returns a new slice and keeps a unchanged.
func (r *RandomState) PermuteInts(a []int) []int {
	out := append([]int(nil), a...)
	shuffle(r, out)
	return out
}

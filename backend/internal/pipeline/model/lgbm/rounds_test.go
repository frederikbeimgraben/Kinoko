package lgbm

import "testing"

// TestTrainRunsEachRound checks that Train goes on after a round without a
// split, as lightgbm.train: a later column sample can still grow a tree.
func TestTrainRunsEachRound(t *testing.T) {
	const n, rounds = 200, 40
	x := make([]float64, 0, 2*n)
	label := make([]float32, n)
	for i := range n {
		// Column 0 has one odd row, so min_data_in_leaf blocks each split on it.
		x = append(x, float64(min(i, 1)), float64(i))
		if i >= n/2 {
			label[i] = 1
		}
	}
	params := "objective=binary feature_pre_filter=false min_data_in_leaf=20 feature_fraction=0.5 seed=7 verbose=-1"
	ds, err := NewDataset(x, n, 2, label, []string{"odd", "rank"}, params)
	if err != nil {
		t.Fatal(err)
	}
	defer ds.Close()
	b, err := Train(ds, params, rounds)
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	got, err := b.Iterations()
	if err != nil {
		t.Fatal(err)
	}
	if got < rounds/4 {
		t.Fatalf("%d of %d rounds grew trees, want the rounds after a round without a split too", got, rounds)
	}
}

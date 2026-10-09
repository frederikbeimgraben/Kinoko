// Package train holds the parts of the training that need no other pipeline unit:
// the LightGBM settings, the folds, the prior columns, the feature pruning rules and the out-of-fold scores.
package train

import "github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/lgbm"

// Constants of the training.
const (
	// Rounds is ROUNDS, the boosting rounds of the base settings.
	Rounds = 300
	// BlockM is BLOCK_M, the edge of a prior block in metres.
	BlockM = 25_000
	// SpaceM is the edge of a band of the space folds in metres.
	SpaceM = 100_000
	// MinGain is the share of the total gain that a feature must earn.
	MinGain = 0.005
	// Tolerance is the distance to the best score within which the shortest feature list wins.
	Tolerance = 0.005
	// MinFoldRows is the smallest test part of a fold.
	MinFoldRows = 100
	// MinFoldPositives is the smallest number of positives in the test part of a fold.
	MinFoldPositives = 10
	// CalibrationShare is the test_size of the split into fit and calibration rows.
	CalibrationShare = 0.25
	// CeilingRows is the smallest number of top calibration rows that set the ceiling.
	CeilingRows = 30
	// CeilingShare is the share of the calibration rows that set the ceiling.
	CeilingShare = 0.02
)

// Sizes is SIZES, the feature list lengths that the pruning tries.
var Sizes = []int{10, 15, 20, 25, 30, 40, 50, 60, 80}

// PriorNames is PRIOR, the prior columns at the end of each feature list.
var PriorNames = []string{"prior_rate_cell", "prior_n_cell", "prior_rate_block", "prior_n_block"}

// Base is the base LightGBM setting, in its key order.
var Base = lgbm.Params{
	{Key: "objective", Value: "binary"},
	{Key: "learning_rate", Value: 0.05},
	{Key: "num_leaves", Value: 31},
	{Key: "min_data_in_leaf", Value: 40},
	{Key: "feature_fraction", Value: 0.8},
	{Key: "bagging_fraction", Value: 0.8},
	{Key: "bagging_freq", Value: 1},
	{Key: "verbosity", Value: -1},
	{Key: "num_threads", Value: 8},
}

// Setting is one entry of GRID: a name, the LightGBM parameters and the boosting rounds.
type Setting struct {
	Name   string
	Params lgbm.Params
	Rounds int
}

// Grid returns the grid of settings. The first entry is the base setting.
func Grid() []Setting {
	return []Setting{
		{"standard", Base, Rounds},
		{"small trees", Base.With("num_leaves", 15).With("min_data_in_leaf", 80).With("learning_rate", 0.03), 600},
		{"smoothed", Base.With("lambda_l2", 10.0).With("min_data_in_leaf", 100).With("feature_fraction", 0.5), 400},
		{"large trees", Base.With("num_leaves", 63).With("min_data_in_leaf", 20), 300},
	}
}

// WithThreads returns the settings with num_threads set to n. The thread count is configurable in the service.
func WithThreads(settings []Setting, n int) []Setting {
	out := make([]Setting, len(settings))
	for i, s := range settings {
		out[i] = Setting{s.Name, s.Params.With("num_threads", n), s.Rounds}
	}
	return out
}

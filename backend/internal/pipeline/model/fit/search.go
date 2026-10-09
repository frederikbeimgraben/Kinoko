package fit

import (
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/train"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/numeric"
)

// Score is the result of evaluate on the year folds and on the space folds.
type Score struct {
	YearAUC, YearAP   float64
	SpaceAUC, SpaceAP float64
}

// Total is the score that the search compares: year AP plus space AP.
func (s Score) Total() float64 { return s.YearAP + s.SpaceAP }

// CandidateScore is one line of the feature table.
type CandidateScore struct {
	Features []string
	Earned   bool
	Score
}

// SettingScore is one line of the settings table.
type SettingScore struct {
	Name string
	Score
}

// folds holds the blocked folds of both schemes.
type folds struct{ year, space []train.Fold }

func (tr *trainer) score(features []string, s train.Setting, f folds) (Score, error) {
	label := tr.t.Label
	yAUC, yAP, err := train.Evaluate(label, f.year, tr.fitPredict(features, s), numeric.RocAUC, numeric.AveragePrecision)
	if err != nil {
		return Score{}, err
	}
	sAUC, sAP, err := train.Evaluate(label, f.space, tr.fitPredict(features, s), numeric.RocAUC, numeric.AveragePrecision)
	return Score{yAUC, yAP, sAUC, sAP}, err
}

// rank trains the ranker on all rows, with the leave-year-out prior over all rows, and sorts the features by gain.
func (tr *trainer) rank(features []string, s train.Setting) (train.Ranking, error) {
	all := allRows(tr.t.N)
	b, err := tr.fit(features, s, train.Prior(tr.rows, all, nil), all)
	if err != nil {
		return train.Ranking{}, err
	}
	defer b.Close()
	gains, err := b.GainImportance()
	if err != nil {
		return train.Ranking{}, err
	}
	return train.Rank(features, gains), nil
}

// prune scores each candidate list with the first setting and chooses the shortest list within Tolerance of the best.
func (tr *trainer) prune(features []string, s train.Setting, f folds) ([]string, []CandidateScore, error) {
	ranking, err := tr.rank(features, s)
	if err != nil {
		return nil, nil, err
	}
	candidates := train.Candidates(ranking, len(features))
	scores := make([]CandidateScore, len(candidates))
	totals := make([]float64, len(candidates))
	for i, c := range candidates {
		sc, err := tr.score(c, s, f)
		if err != nil {
			return nil, nil, err
		}
		scores[i] = CandidateScore{Features: c, Earned: sameList(c, ranking.Earned), Score: sc}
		totals[i] = sc.Total()
		tr.logf("%9d %9.4f %8.4f %10.4f %9.4f", len(c), sc.YearAUC, sc.YearAP, sc.SpaceAUC, sc.SpaceAP)
	}
	return candidates[train.ChooseList(totals)], scores, nil
}

// tune scores each setting of grid on the chosen list. The first strict maximum wins.
func (tr *trainer) tune(features []string, grid []train.Setting, f folds) (train.Setting, []SettingScore, error) {
	scores := make([]SettingScore, len(grid))
	totals := make([]float64, len(grid))
	for i, s := range grid {
		sc, err := tr.score(features, s, f)
		if err != nil {
			return train.Setting{}, nil, err
		}
		scores[i], totals[i] = SettingScore{s.Name, sc}, sc.Total()
		tr.logf("%-12s %9.4f %8.4f %10.4f %9.4f", s.Name, sc.YearAUC, sc.YearAP, sc.SpaceAUC, sc.SpaceAP)
	}
	return grid[train.PickSetting(totals)], scores, nil
}

// sameList tells if a and b are the same slice, not only equal lists.
func sameList(a, b []string) bool {
	return len(a) == len(b) && (len(a) == 0 || &a[0] == &b[0])
}

func allRows(n int) []int {
	out := make([]int, n)
	for i := range out {
		out[i] = i
	}
	return out
}

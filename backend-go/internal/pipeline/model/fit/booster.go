package fit

import (
	"context"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/lgbm"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/train"
)

// trainer trains and predicts LightGBM models on the rows of one visit table.
type trainer struct {
	ctx   context.Context
	t     *Table
	label []float32
	rows  train.Rows
	logf  func(format string, args ...any)
}

func newTrainer(ctx context.Context, t *Table, logf func(string, ...any)) *trainer {
	label := make([]float32, t.N)
	for i, y := range t.Label {
		label[i] = float32(y)
	}
	return &trainer{ctx: ctx, t: t, label: label, rows: t.PriorRows(), logf: logf}
}

// fit is lgb.train(params, lgb.Dataset(x.iloc[rows], label=y[rows]), num_boost_round=rounds).
// The parameter text goes to the dataset and the booster, as lightgbm.train hands it to both.
func (tr *trainer) fit(features []string, s train.Setting, prior train.PriorColumns, rows []int) (*lgbm.Booster, error) {
	if err := tr.ctx.Err(); err != nil {
		return nil, err
	}
	x, err := tr.t.Design(features, prior, rows)
	if err != nil {
		return nil, err
	}
	params := s.Params.ForTrain(s.Rounds).String()
	ds, err := lgbm.NewDataset(x, len(rows), len(features), pick(tr.label, rows), features, params)
	if err != nil {
		return nil, err
	}
	defer ds.Close()
	return lgbm.Train(ds, params, s.Rounds)
}

// predict is model.predict(x.iloc[rows]): the raw probability of each row, in the order of rows.
func (tr *trainer) predict(b *lgbm.Booster, features []string, prior train.PriorColumns, rows []int) ([]float64, error) {
	x, err := tr.t.Design(features, prior, rows)
	if err != nil {
		return nil, err
	}
	return lgbm.Predict(b, x, len(rows), len(features), 0)
}

// fitPredict trains on fold.Train and predicts fold.Test, with the prior of the fold.
func (tr *trainer) fitPredict(features []string, s train.Setting) train.FitPredict {
	return func(fold train.Fold) ([]float64, error) {
		prior := train.Prior(tr.rows, fold.Train, fold.Test)
		b, err := tr.fit(features, s, prior, fold.Train)
		if err != nil {
			return nil, err
		}
		defer b.Close()
		return tr.predict(b, features, prior, fold.Test)
	}
}

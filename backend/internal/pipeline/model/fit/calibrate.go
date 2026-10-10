package fit

import (
	"math"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/lgbm"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/train"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/numeric"
)

// splitSeed is the seed of the split into fit and calibration rows.
const splitSeed = 0

// calibrated is the result of fitCalibrated: a model with its isotonic curve and its ceiling.
type calibrated struct {
	booster *lgbm.Booster
	horizon bundle.Horizon
}

// fitCalibrated trains on fit and calibrates on cal.
func (tr *trainer) fitCalibrated(features []string, s train.Setting, fit, cal []int) (calibrated, error) {
	prior := train.Prior(tr.rows, fit, cal)
	b, err := tr.fit(features, s, prior, fit)
	if err != nil {
		return calibrated{}, err
	}
	raw, err := tr.predict(b, features, prior, cal)
	if err != nil {
		b.Close()
		return calibrated{}, err
	}
	y := pick(tr.t.Label, cal)
	yf := make([]float64, len(y))
	for i, v := range y {
		yf[i] = float64(v)
	}
	iso := numeric.FitIsotonic(raw, yf)
	hz := bundle.Horizon{
		Features: features, Ceiling: train.Ceiling(raw, y), Rounds: s.Rounds, Params: s.Params,
		Isotonic: bundle.Isotonic{X: iso.X, Y: iso.Y, XMin: iso.XMin, XMax: iso.XMax, Increasing: true, OutOfBounds: "clip"},
		Booster:  b,
	}
	return calibrated{b, hz}, nil
}

// OOF holds the out-of-fold predictions of one horizon. Both are NaN outside the test parts of the year folds.
type OOF struct {
	Raw        []float64
	Calibrated []float64
	Scores     train.OOFScores
}

// outOfFold calibrates inside each year fold and predicts its test part.
func (tr *trainer) outOfFold(features []string, s train.Setting, year []train.Fold) (OOF, error) {
	raw, cal := nanSlice(tr.t.N), nanSlice(tr.t.N)
	for _, fold := range year {
		fit, calRows, err := numeric.StratifiedSplit(fold.Train, pick(tr.t.Label, fold.Train), train.CalibrationShare, splitSeed)
		if err != nil {
			return OOF{}, err
		}
		c, err := tr.fitCalibrated(features, s, fit, calRows)
		if err != nil {
			return OOF{}, err
		}
		p, err := tr.predict(c.booster, features, train.Prior(tr.rows, fit, fold.Test), fold.Test)
		c.booster.Close()
		if err != nil {
			return OOF{}, err
		}
		for k, i := range fold.Test {
			raw[i] = p[k]
		}
		for k, v := range c.horizon.Calibrated(p) {
			cal[fold.Test[k]] = v
		}
	}
	return OOF{raw, cal, train.OOF(tr.t.Label, raw, cal, numeric.RocAUC)}, nil
}

// final splits all rows 75/25 with stratification and fits the model of the bundle.
func (tr *trainer) final(features []string, s train.Setting) (calibrated, error) {
	fit, cal, err := numeric.StratifiedSplit(allRows(tr.t.N), tr.t.Label, train.CalibrationShare, splitSeed)
	if err != nil {
		return calibrated{}, err
	}
	return tr.fitCalibrated(features, s, fit, cal)
}

func nanSlice(n int) []float64 {
	out := make([]float64, n)
	for i := range out {
		out[i] = math.NaN()
	}
	return out
}

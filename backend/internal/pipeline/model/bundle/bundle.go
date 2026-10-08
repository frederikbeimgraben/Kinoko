// Package bundle reads and writes a trained species model: bundle.json and one LightGBM text model per horizon.
// It applies the model as final_model.calibrated does: raw score, isotonic curve, then the ceiling.
package bundle

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/lgbm"
)

// Format is the version of the bundle.json layout that this package reads and writes.
const Format = 1

// FileName is the name of the sidecar file in a bundle directory.
const FileName = "bundle.json"

// Horizon is the model of one forecast horizon. Booster is nil until Load or the trainer sets it.
type Horizon struct {
	Model    string        `json:"model"`
	Features []string      `json:"features"`
	Ceiling  float64       `json:"ceiling"`
	Rounds   int           `json:"rounds"`
	Params   lgbm.Params   `json:"params"`
	Isotonic Isotonic      `json:"isotonic"`
	Metrics  *Metrics      `json:"metrics,omitempty"`
	Booster  *lgbm.Booster `json:"-"`
}

// Bundle is the model of one species, with all horizons and the prior tables.
type Bundle struct {
	Format    int              `json:"format"`
	Label     string           `json:"label"`
	Species   []string         `json:"species"`
	Slug      string           `json:"slug"`
	Horizons  map[int]*Horizon `json:"horizons"`
	Prior     Prior            `json:"prior"`
	TrainedAt string           `json:"trainedAt"`
	Visits    int              `json:"visits"`
	Positives int              `json:"positives"`
}

// ModelFile returns the file name of the text model of horizon h.
func ModelFile(h int) string { return "h" + strconv.Itoa(h) + ".txt" }

// Load reads bundle.json and each text model from dir. Close the bundle to free the boosters.
func Load(dir string) (*Bundle, error) {
	data, err := os.ReadFile(filepath.Join(dir, FileName))
	if err != nil {
		return nil, err
	}
	var b Bundle
	if err := json.Unmarshal(data, &b); err != nil {
		return nil, fmt.Errorf("bundle: %s: %w", FileName, err)
	}
	if err := b.validate(); err != nil {
		return nil, err
	}
	for _, h := range b.HorizonKeys() {
		if err := b.Horizons[h].load(dir); err != nil {
			b.Close()
			return nil, fmt.Errorf("bundle: horizon %d: %w", h, err)
		}
	}
	return &b, nil
}

func (b *Bundle) validate() error {
	if b.Format != Format {
		return fmt.Errorf("bundle: format %d is not supported", b.Format)
	}
	if len(b.Horizons) == 0 {
		return errors.New("bundle: no horizons")
	}
	for h, hz := range b.Horizons {
		if hz == nil {
			return fmt.Errorf("bundle: horizon %d is empty", h)
		}
		if err := hz.Isotonic.Validate(); err != nil {
			return fmt.Errorf("bundle: horizon %d: %w", h, err)
		}
		if math.IsNaN(hz.Ceiling) || hz.Ceiling < 0 || hz.Ceiling > 1 {
			return fmt.Errorf("bundle: horizon %d: ceiling %v is not a probability", h, hz.Ceiling)
		}
	}
	return errors.Join(b.Prior.Cell.Validate(), b.Prior.Block.Validate())
}

// load reads the text model. The model file must sit in dir, so a bundle cannot point outside its directory.
func (hz *Horizon) load(dir string) error {
	if hz.Model == "" || filepath.Base(hz.Model) != hz.Model || strings.HasPrefix(hz.Model, ".") {
		return fmt.Errorf("model file name %q is not a plain file name", hz.Model)
	}
	text, err := os.ReadFile(filepath.Join(dir, hz.Model))
	if err != nil {
		return err
	}
	booster, err := lgbm.Load(string(text))
	if err != nil {
		return err
	}
	names, err := booster.FeatureNames()
	if err == nil && !slices.Equal(names, hz.Features) {
		err = fmt.Errorf("features of %s differ from the bundle: %v against %v", hz.Model, names, hz.Features)
	}
	if err != nil {
		booster.Close()
		return err
	}
	hz.Booster = booster
	return nil
}

// Save writes each booster as h<k>.txt and then bundle.json into dir. It does not change b.
// bundle.json comes last and replaces the old file in one rename, so a reader never sees a half bundle.
func (b *Bundle) Save(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	out := *b
	out.Format = Format
	out.Horizons = make(map[int]*Horizon, len(b.Horizons))
	for _, h := range b.HorizonKeys() {
		hz := *b.Horizons[h]
		if hz.Booster == nil {
			return fmt.Errorf("bundle: horizon %d has no booster", h)
		}
		text, err := hz.Booster.Text()
		if err != nil {
			return err
		}
		hz.Model = ModelFile(h)
		if err := writeAtomic(filepath.Join(dir, hz.Model), []byte(text)); err != nil {
			return err
		}
		out.Horizons[h] = &hz
	}
	data, err := json.Marshal(&out)
	if err != nil {
		return err
	}
	return writeAtomic(filepath.Join(dir, FileName), data)
}

func writeAtomic(path string, data []byte) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".*")
	if err != nil {
		return err
	}
	// After the rename the temporary name does not exist, so the error is expected.
	defer func() { _ = os.Remove(tmp.Name()) }()
	_, err = tmp.Write(data)
	if err = errors.Join(err, tmp.Sync(), tmp.Close()); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

// Close frees the booster of each horizon.
func (b *Bundle) Close() {
	for _, hz := range b.Horizons {
		if hz != nil && hz.Booster != nil {
			hz.Booster.Close()
		}
	}
}

// HorizonKeys returns the horizons in ascending order.
func (b *Bundle) HorizonKeys() []int { return slices.Sorted(maps.Keys(b.Horizons)) }

// Top returns the largest ceiling over the horizons: the top of the map scale in region_map.py.
func (b *Bundle) Top() float64 {
	top := math.Inf(-1)
	for _, hz := range b.Horizons {
		top = max(top, hz.Ceiling)
	}
	return top
}

// Calibrated applies the isotonic curve to each raw score and caps it at the ceiling.
// NaN stays NaN, as in np.minimum.
func (hz *Horizon) Calibrated(raw []float64) []float64 {
	out := hz.Isotonic.PredictAll(raw)
	for i, p := range out {
		out[i] = math.Min(p, hz.Ceiling)
	}
	return out
}

// Probability predicts a row-major float32 matrix with the columns in Features order and calibrates it.
func (hz *Horizon) Probability(x []float32, nrow, threads int) ([]float64, error) {
	if hz.Booster == nil {
		return nil, errors.New("bundle: horizon has no booster")
	}
	raw, err := hz.Booster.Predict(x, nrow, len(hz.Features), threads)
	if err != nil {
		return nil, err
	}
	return hz.Calibrated(raw), nil
}

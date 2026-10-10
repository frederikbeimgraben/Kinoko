package bundle

import (
	"fmt"
	"math"
)

// PriorTable holds the target rate and the visit count of each key ("x_y"), over all training visits.
type PriorTable struct {
	Keys []string   `json:"keys"`
	Rate NullFloats `json:"rate"`
	N    []float64  `json:"n"`
}

// Prior holds the prior tables of the 5 km cells and of the 25 km blocks.
type Prior struct {
	Cell  PriorTable `json:"cell"`
	Block PriorTable `json:"block"`
}

// Validate makes sure that the columns have the same length and the keys are unique.
func (t PriorTable) Validate() error {
	if len(t.Rate) != len(t.Keys) || len(t.N) != len(t.Keys) {
		return fmt.Errorf("prior: %d keys, %d rates, %d counts", len(t.Keys), len(t.Rate), len(t.N))
	}
	if len(t.index()) != len(t.Keys) {
		return fmt.Errorf("prior: keys are not unique")
	}
	return nil
}

func (t PriorTable) index() map[string]int {
	out := make(map[string]int, len(t.Keys))
	for i, key := range t.Keys {
		out[key] = i
	}
	return out
}

// Lookup returns a function that gives rate and n of a key.
// A key without visits gives NaN and 0.
func (t PriorTable) Lookup() func(key string) (rate, n float64) {
	index := t.index()
	return func(key string) (float64, float64) {
		i, ok := index[key]
		if !ok {
			return math.NaN(), 0
		}
		return t.Rate[i], t.N[i]
	}
}

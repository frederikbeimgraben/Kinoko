package bundle

import (
	"encoding/json"
	"math"
)

// NullFloats is a float list whose NaN values are JSON null, as the bundle stores a missing rate.
type NullFloats []float64

// MarshalJSON writes NaN as null.
func (f NullFloats) MarshalJSON() ([]byte, error) {
	items := make([]*float64, len(f))
	for i := range f {
		if !math.IsNaN(f[i]) {
			items[i] = &f[i]
		}
	}
	return json.Marshal(items)
}

// UnmarshalJSON reads null as NaN.
func (f *NullFloats) UnmarshalJSON(data []byte) error {
	var items []*float64
	if err := json.Unmarshal(data, &items); err != nil {
		return err
	}
	out := make(NullFloats, len(items))
	for i, item := range items {
		out[i] = math.NaN()
		if item != nil {
			out[i] = *item
		}
	}
	*f = out
	return nil
}

// Metrics are the out-of-fold scores of a horizon. NaN means not measured.
type Metrics struct {
	BrierRaw        float64
	BrierCalibrated float64
	AUCOOF          float64
}

type metricsJSON struct {
	BrierRaw        *float64 `json:"brierRaw"`
	BrierCalibrated *float64 `json:"brierCalibrated"`
	AUCOOF          *float64 `json:"aucOof"`
}

func nullable(v float64) *float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return nil
	}
	return &v
}

func orNaN(p *float64) float64 {
	if p == nil {
		return math.NaN()
	}
	return *p
}

// MarshalJSON writes NaN as null.
func (m Metrics) MarshalJSON() ([]byte, error) {
	return json.Marshal(metricsJSON{nullable(m.BrierRaw), nullable(m.BrierCalibrated), nullable(m.AUCOOF)})
}

// UnmarshalJSON reads null or a missing field as NaN.
func (m *Metrics) UnmarshalJSON(data []byte) error {
	var raw metricsJSON
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	*m = Metrics{orNaN(raw.BrierRaw), orNaN(raw.BrierCalibrated), orNaN(raw.AUCOOF)}
	return nil
}

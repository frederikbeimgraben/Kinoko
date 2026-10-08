package hist

import (
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"math"
	"os"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

func f64(t *testing.T, s string) float64 {
	t.Helper()
	b, err := hex.DecodeString(s)
	if err != nil || len(b) != 8 {
		t.Fatalf("bad hex %q", s)
	}
	return math.Float64frombits(binary.BigEndian.Uint64(b))
}

// histogram.json comes from testdata/golden.py (hist_golden): manifest.histogram,
// written with json.dumps(h, separators=(",", ":")).
func TestComputeMatchesPython(t *testing.T) {
	raw, err := os.ReadFile("testdata/histogram.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Values    []string
		Low, High string
		JSON      *string
	}
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	for i, c := range cases {
		vals := make([]float64, len(c.Values))
		for j, s := range c.Values {
			vals[j] = f64(t, s)
		}
		h, err := Compute(vals, f64(t, c.Low), f64(t, c.High))
		if err != nil {
			t.Fatalf("case %d: %v", i, err)
		}
		switch {
		case c.JSON == nil && h != nil:
			t.Errorf("case %d: want nil, got %v", i, h)
		case c.JSON != nil && h == nil:
			t.Errorf("case %d: got nil", i)
		case c.JSON != nil:
			if got := string(pyjson.MarshalCompact(h, true)); got != *c.JSON {
				t.Errorf("case %d:\n got %s\nwant %s", i, got, *c.JSON)
			}
		}
	}
}

func TestComputeRules(t *testing.T) {
	if _, err := Compute([]float64{1}, 5, 5); err == nil {
		t.Error("a scale without width must fail")
	}
	if _, err := Compute([]float64{1}, math.NaN(), 1); err == nil {
		t.Error("a NaN scale must fail")
	}
	h, err := ComputeFloat32([]float32{0, 0, 1}, 0, 1)
	if err != nil || len(h.Classes) != Classes+1 || len(h.Shares) != Classes {
		t.Fatalf("got %v, %v", h, err)
	}
	if h.Shares[0] != 0.666667 || h.Shares[Classes-1] != 0.333333 {
		t.Errorf("shares %v", h.Shares)
	}
}

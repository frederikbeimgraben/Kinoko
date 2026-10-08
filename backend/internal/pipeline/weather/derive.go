package weather

import (
	"fmt"
	"math"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
)

// Feature constants of build_dataset.py.
var (
	Lags        = []int{0, 1, 2, 3, 4, 6, 8}
	LagVars     = []string{"pr", "tas", "tasmin"}
	Windows     = []int{2, 4, 8}
	AnomalyVars = []string{"pr_sum4", "pr_sum8", "tas"}
)

// LagNames returns the columns of build_dataset.add_lags, in its order.
func LagNames() []string {
	var out []string
	for _, v := range LagVars {
		for _, l := range Lags {
			out = append(out, fmt.Sprintf("%s_lag%d", v, l))
		}
		tag := "mean"
		if v == "pr" {
			tag = "sum"
		}
		for _, w := range Windows {
			out = append(out, fmt.Sprintf("%s_%s%d", v, tag, w))
		}
	}
	return append(out, "tas_drop_2w", "tas_drop_4w")
}

// AnomalyNames returns the columns of build_dataset.add_anomalies.
func AnomalyNames() []string {
	out := make([]string, len(AnomalyVars))
	for i, v := range AnomalyVars {
		out[i] = v + "_anom"
	}
	return out
}

// Normals holds the mean of each base column per cell and ISO week number over
// each year of a cube: the normal value of add_anomalies and region_map.normalwerte.
type Normals struct {
	index map[geo.CellKey]int
	bases map[string][][54]float64
}

// ComputeNormals computes the normals of bases over the whole cube c, forecast
// weeks included (they hold NaN and add nothing).
func ComputeNormals(c *Cube, bases []string) (*Normals, error) {
	n := &Normals{index: c.index, bases: map[string][][54]float64{}}
	for _, b := range bases {
		n.bases[b] = make([][54]float64, len(c.Cells))
	}
	for i := range c.Cells {
		s := newCellSeries(c, i, nil)
		for _, b := range bases {
			vals, err := s.get(b)
			if err != nil {
				return nil, err
			}
			var sum [54]float64
			var cnt [54]int
			for w, v := range vals {
				if !math.IsNaN(v) {
					sum[c.Weeks[w].Week] += v
					cnt[c.Weeks[w].Week]++
				}
			}
			for k := range sum {
				n.bases[b][i][k] = math.NaN()
				if cnt[k] > 0 {
					n.bases[b][i][k] = sum[k] / float64(cnt[k])
				}
			}
		}
	}
	return n, nil
}

// Derive computes the named features of each cell-week of c, as [w*len(Cells)+c].
// The anomalies use normals over c itself, as add_anomalies on the same table.
func Derive(c *Cube, names []string) (map[string][]float32, error) {
	n, err := ComputeNormals(c, anomalyBases(names))
	if err != nil {
		return nil, err
	}
	return DeriveWith(c, names, n)
}

// DeriveWith is Derive with normals from another cube, for example the full record when c holds only the last
// weeks (region_map.py). A name is a column of c, "paws" (the mean of PawsVars), <base>_lag<k>, _sum<w>,
// _mean<w>, _mittel<w>, _drop_<k>w, or <base>_anom and _ratio against the normals.
func DeriveWith(c *Cube, names []string, n *Normals) (map[string][]float32, error) {
	nc, nw := len(c.Cells), len(c.Weeks)
	out := make(map[string][]float32, len(names))
	for _, name := range names {
		out[name] = make([]float32, nw*nc)
	}
	for i := range c.Cells {
		s := newCellSeries(c, i, n)
		for _, name := range names {
			vals, err := s.get(name)
			if err != nil {
				return nil, err
			}
			dst := out[name]
			for w, v := range vals {
				dst[w*nc+i] = float32(v)
			}
		}
	}
	return out, nil
}

// Inputs gives the checkpoints of Jobs that the names of DeriveWith read, sorted.
// A name that is not a feature of DeriveWith stays as it is.
func Inputs(names []string) []string {
	out := []string{}
	for _, name := range names {
		out = append(out, inputsOf(name)...)
	}
	slices.Sort(out)
	return slices.Compact(out)
}

func inputsOf(name string) []string {
	if slices.ContainsFunc(Jobs, func(j Job) bool { return j.Name == name }) {
		return []string{name}
	}
	if name == "paws" {
		return PawsVars
	}
	for _, suffix := range []string{"_anom", "_ratio"} {
		if base, ok := strings.CutSuffix(name, suffix); ok {
			return inputsOf(base)
		}
	}
	for _, re := range []*regexp.Regexp{dropRe, lagRe, rollRe} {
		if m := re.FindStringSubmatch(name); m != nil {
			return inputsOf(m[1])
		}
	}
	return []string{name}
}

func anomalyBases(names []string) []string {
	var out []string
	for _, name := range names {
		for _, suffix := range []string{"_anom", "_ratio"} {
			if b, ok := strings.CutSuffix(name, suffix); ok && !slices.Contains(out, b) {
				out = append(out, b)
			}
		}
	}
	return out
}

var (
	dropRe = regexp.MustCompile(`^(.+)_drop_(\d+)w$`)
	lagRe  = regexp.MustCompile(`^(.+)_lag(\d+)$`)
	rollRe = regexp.MustCompile(`^(.+)_(sum|mean|mittel)(\d+)$`)
)

// cellSeries computes the features of one cell over the weeks, in float64 as pandas does.
type cellSeries struct {
	c       *Cube
	i       int
	normals *Normals
	memo    map[string][]float64
}

func newCellSeries(c *Cube, i int, n *Normals) *cellSeries {
	return &cellSeries{c: c, i: i, normals: n, memo: map[string][]float64{}}
}

func (s *cellSeries) get(name string) ([]float64, error) {
	if v, ok := s.memo[name]; ok {
		return v, nil
	}
	v, err := s.compute(name)
	if err != nil {
		return nil, err
	}
	s.memo[name] = v
	return v, nil
}

func (s *cellSeries) compute(name string) ([]float64, error) {
	if _, ok := s.c.Vars[name]; ok {
		return s.raw(name), nil
	}
	if name == "paws" {
		return s.pawsMean()
	}
	if base, ok := strings.CutSuffix(name, "_anom"); ok {
		return s.againstNormal(base, func(v, n float64) float64 { return v - n })
	}
	if base, ok := strings.CutSuffix(name, "_ratio"); ok {
		return s.againstNormal(base, func(v, n float64) float64 {
			if n == 0 {
				return math.NaN()
			}
			return v / n
		})
	}
	if m := dropRe.FindStringSubmatch(name); m != nil {
		k, _ := strconv.Atoi(m[2])
		base, err := s.get(m[1])
		if err != nil {
			return nil, err
		}
		lagged := shift(base, k)
		for w := range lagged {
			lagged[w] -= base[w]
		}
		return lagged, nil
	}
	if m := lagRe.FindStringSubmatch(name); m != nil {
		k, _ := strconv.Atoi(m[2])
		base, err := s.get(m[1])
		if err != nil {
			return nil, err
		}
		return shift(base, k), nil
	}
	if m := rollRe.FindStringSubmatch(name); m != nil {
		window, _ := strconv.Atoi(m[3])
		base, err := s.get(m[1])
		if err != nil {
			return nil, err
		}
		return rolling(base, window, m[2] == "sum"), nil
	}
	return nil, fmt.Errorf("weather: unknown feature %q", name)
}

func (s *cellSeries) raw(name string) []float64 {
	vals, nc := s.c.Vars[name], len(s.c.Cells)
	out := make([]float64, len(s.c.Weeks))
	for w := range out {
		out[w] = float64(vals[w*nc+s.i])
	}
	return out
}

// pawsMean is the mean of the stands that have a value, rounded to float32 (input_layers.wochenwetter).
func (s *cellSeries) pawsMean() ([]float64, error) {
	out := make([]float64, len(s.c.Weeks))
	cnt := make([]int, len(out))
	for _, v := range PawsVars {
		if _, ok := s.c.Vars[v]; !ok {
			return nil, fmt.Errorf("weather: paws needs column %s", v)
		}
		for w, x := range s.raw(v) {
			if !math.IsNaN(x) {
				out[w] += x
				cnt[w]++
			}
		}
	}
	for w := range out {
		if cnt[w] == 0 {
			out[w] = math.NaN()
		} else {
			out[w] = float64(float32(out[w] / float64(cnt[w])))
		}
	}
	return out, nil
}

func (s *cellSeries) againstNormal(base string, f func(v, n float64) float64) ([]float64, error) {
	vals, err := s.get(base)
	if err != nil {
		return nil, err
	}
	if s.normals == nil || s.normals.bases[base] == nil {
		return nil, fmt.Errorf("weather: no normals for %s", base)
	}
	out := make([]float64, len(vals))
	pos, ok := s.normals.index[s.c.Cells[s.i]]
	for w, v := range vals {
		out[w] = math.NaN()
		if ok {
			out[w] = f(v, s.normals.bases[base][pos][s.c.Weeks[w].Week])
		}
	}
	return out, nil
}

// shift moves the values k weeks later, as groupby(cell).shift(k); the first k weeks are NaN.
func shift(v []float64, k int) []float64 {
	out := make([]float64, len(v))
	for w := range out {
		out[w] = math.NaN()
		if w-k >= 0 && w-k < len(v) {
			out[w] = v[w-k]
		}
	}
	return out
}

// rolling is rolling(window, min_periods=window).sum() or .mean(): a window with a NaN gives NaN.
func rolling(v []float64, window int, sum bool) []float64 {
	out := make([]float64, len(v))
	for w := range out {
		out[w] = math.NaN()
		if w+1 < window {
			continue
		}
		total := 0.0
		for _, x := range v[w+1-window : w+1] {
			total += x
		}
		if math.IsNaN(total) {
			continue
		}
		if sum {
			out[w] = total
		} else {
			out[w] = total / float64(window)
		}
	}
	return out
}

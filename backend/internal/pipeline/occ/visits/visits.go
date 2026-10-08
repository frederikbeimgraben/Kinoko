// Package visits reduces the occurrence records to visits, as
// visit_model.build_visits and build_occurrences.visit_gate. A visit is one
// observer, on one day, inside one square kilometre.
package visits

import (
	"errors"
	"fmt"
	"math"
	"slices"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
)

// Constants of visit_model.py.
const (
	MinSpecies     = 2     // --min-species
	MinYear        = 2015  // --min-year
	MaxUncertainty = 500.0 // --max-uncertainty, metres
	MinPositives   = 100   // the run stops below this many positive visits
	KmM            = 1000  // the edge of the visit square in metres
)

// Detection and Season are DETECTION and SEASON of visit_model.py, the first feature blocks.
var (
	Detection = []string{"n_records", "n_species"}
	Season    = []string{"iso_week", "week_sin", "week_cos"}
)

// ErrTooFewPositives tells that the gated visits hold fewer than MinPositives positives.
var ErrTooFewPositives = errors.New("visits: too few positive visits")

// Visit is one row of the visit table. Label is 1 when the visit found a target taxon.
type Visit struct {
	Key      string
	NRecords int
	NSpecies int
	Label    int8
	FromApp  int8
	Lon, Lat float64
	X, Y     float64
	Cell     geo.CellKey
	Date     time.Time
	ISOYear  int
	ISOWeek  int
}

// Key is the visit key "observer|YYYY-MM-DD|kmx_kmy" of a record.
// The groupby of pandas sorts by this text, and the visit table keeps that order.
func Key(r occ.Record) string {
	return fmt.Sprintf("%s|%s|%d_%d", r.Observer, r.Date.Format(time.DateOnly),
		int64(geo.FloorDiv(r.X, KmM)), int64(geo.FloorDiv(r.Y, KmM)))
}

// Gate is visit_gate: a visit with at least minSpecies species is a real absence or
// a find. An app find is presence-only, so it passes only when it found a target.
func Gate(v Visit, minSpecies int) bool {
	return v.NSpecies >= minSpecies || (v.FromApp == 1 && v.Label == 1)
}

// Build is build_visits: it groups the records with an observer into visits,
// sorted by key, and keeps the visits that pass Gate. Pass the records of occ.TrainingSet.
func Build(records []occ.Record, taxa []string, minSpecies int) []Visit {
	groups := map[string]*group{}
	for _, r := range records {
		if !r.HasObserver() {
			continue
		}
		k := Key(r)
		g := groups[k]
		if g == nil {
			g = &group{species: map[string]bool{}, first: r}
			groups[k] = g
		}
		g.add(r, slices.Contains(taxa, r.Species))
	}
	keys := make([]string, 0, len(groups))
	for k := range groups {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	out := make([]Visit, 0, len(keys))
	for _, k := range keys {
		if v := groups[k].visit(k); Gate(v, minSpecies) {
			out = append(out, v)
		}
	}
	return out
}

// Positives counts the visits with Label 1.
func Positives(vs []Visit) int {
	n := 0
	for _, v := range vs {
		n += int(v.Label)
	}
	return n
}

// CheckPositives gives ErrTooFewPositives when vs holds fewer than MinPositives positives.
func CheckPositives(vs []Visit) error {
	if p := Positives(vs); p < MinPositives {
		return fmt.Errorf("%w: %d", ErrTooFewPositives, p)
	}
	return nil
}

// WeekSinCos gives week_sin and week_cos of an ISO week: sin and cos of 2*pi*week/52.
func WeekSinCos(week int) (float64, float64) {
	a := 2 * math.Pi * float64(week) / 52.0
	return math.Sin(a), math.Cos(a)
}

// group collects the aggregates of one visit.
type group struct {
	n              int
	species        map[string]bool
	label, app     int8
	lon, lat, x, y kahan
	first          occ.Record
}

func (g *group) add(r occ.Record, target bool) {
	g.n++
	if r.Species != "" {
		g.species[r.Species] = true
	}
	if target {
		g.label = 1
	}
	if r.Basis == occ.BasisApp {
		g.app = 1
	}
	g.lon.add(r.Lon)
	g.lat.add(r.Lat)
	g.x.add(r.X)
	g.y.add(r.Y)
}

// visit gives the row of the group. The "first" columns come from the first record,
// because cell, date and ISO week are equal across the records of one visit.
func (g *group) visit(key string) Visit {
	return Visit{
		Key: key, NRecords: g.n, NSpecies: len(g.species), Label: g.label, FromApp: g.app,
		Lon: g.lon.mean(), Lat: g.lat.mean(), X: g.x.mean(), Y: g.y.mean(),
		Cell: g.first.Cell, Date: g.first.Date, ISOYear: g.first.ISOYear, ISOWeek: g.first.ISOWeek,
	}
}

// kahan is the compensated sum of pandas group_mean, so the mean has the same bits.
type kahan struct {
	sum, comp float64
	n         int
}

func (k *kahan) add(v float64) {
	if math.IsNaN(v) {
		return
	}
	k.n++
	y := v - k.comp
	t := k.sum + y
	k.comp = t - k.sum - y
	k.sum = t
}

func (k *kahan) mean() float64 {
	if k.n == 0 {
		return math.NaN()
	}
	return k.sum / float64(k.n)
}

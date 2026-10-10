// Package season builds the season table of the app: per
// calendar week the visits and the visits with a find of each species, for
// the closed years and the running year apart. The backend reads it as daten/saison.json.
package season

import (
	"errors"
	"os"
	"path/filepath"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/visits"
)

// Constants of the season table.
const (
	Wochen             = 52
	AbJahr             = 2015
	MinArten           = 2
	MaxUnsicherheitM   = 500.0
	SchwelleVorhersage = 600
	SchwelleSaison     = 60
)

// ErrNoVisits tells that no record lies in a usable visit.
var ErrNoVisits = errors.New("season: no visits")

// Entry is a record inside a usable visit, with its visit key.
type Entry struct {
	Visit string
	occ.Record
}

// Begehungen is begehungen_bilden: the records from abJahr with an observer and
// a coordinate error of at most maxUnc metres (NaN keeps), in visits with at least minArten species.
func Begehungen(records []occ.Record, abJahr, minArten int, maxUnc float64) []Entry {
	var kept []Entry
	species := map[string]map[string]bool{}
	for _, r := range records {
		if r.ISOYear < abJahr || !r.HasObserver() || !r.UncertaintyAtMost(maxUnc) {
			continue
		}
		e := Entry{Visit: visits.Key(r), Record: r}
		kept = append(kept, e)
		if species[e.Visit] == nil {
			species[e.Visit] = map[string]bool{}
		}
		if r.Species != "" {
			species[e.Visit][r.Species] = true
		}
	}
	out := kept[:0:0]
	for _, e := range kept {
		if len(species[e.Visit]) >= minArten {
			out = append(out, e)
		}
	}
	return out
}

// LastFullWeek is letzte_volle_woche: the ISO week of the last Monday-to-Sunday
// week that the data covers up to day d. Week 53 gives 52.
func LastFullWeek(d time.Time) calendar.Week {
	ende := d.AddDate(0, 0, -(isoWeekday(d) % 7))
	w := calendar.WeekOf(ende)
	return calendar.Week{Year: w.Year, Week: min(w.Week, Wochen)}
}

func isoWeekday(d time.Time) int { return (int(d.Weekday())+6)%7 + 1 }

// Stand gives LastFullWeek of the latest date of the entries, as _stand_lesen without --stand.
func Stand(entries []Entry) (calendar.Week, error) {
	if len(entries) == 0 {
		return calendar.Week{}, ErrNoVisits
	}
	last := entries[0].Date
	for _, e := range entries[1:] {
		if e.Date.After(last) {
			last = e.Date
		}
	}
	return LastFullWeek(last), nil
}

// Stufe is stufe: the level of a species by its visits since AbJahr.
func Stufe(besuche int) string {
	switch {
	case besuche >= SchwelleVorhersage:
		return "Vorhersage"
	case besuche >= SchwelleSaison:
		return "Saison"
	}
	return "Profil"
}

// Write writes the table as compact JSON, not ASCII-escaped, and a line end.
// It creates the parent folder and replaces the file atomically.
func Write(path string, table *pyjson.Obj) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return pyjson.WriteFileAtomic(path, Marshal(table))
}

// Marshal formats the table as json.dumps(ensure_ascii=False, separators=(",", ":")) plus "\n".
func Marshal(table *pyjson.Obj) []byte {
	return append(pyjson.MarshalCompact(table, false), '\n')
}

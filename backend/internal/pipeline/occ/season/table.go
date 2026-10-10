package season

import (
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/calendar"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

// Series is one week series: 52 counts, week 53 folded into week 52.
type Series [Wochen]int

// add is wochenreihe for one count of an ISO week.
func (s *Series) add(week int) {
	if n := min(week, Wochen); n >= 1 {
		s[n-1]++
	}
}

// PyJSON gives the series as a JSON list.
func (s Series) PyJSON() any { return s[:] }

// Table gives the season table: the visits per week and the visits with a find per
// week and species, for the years before stand.Year and for stand.Year apart.
// latin sets the species and their order; pass LatinNames() for the list of Arten.
func Table(entries []Entry, latin []string, stand calendar.Week) (*pyjson.Obj, error) {
	if len(entries) == 0 {
		return nil, ErrNoVisits
	}
	type perSpecies struct {
		visits          int
		closed, running Series
	}
	arten := map[string]*perSpecies{}
	for _, name := range latin {
		arten[name] = &perSpecies{}
	}
	var closed, running Series
	firstYear := 0
	seenVisit := map[string]bool{}
	seenPair := map[[2]string]bool{}
	for _, e := range entries {
		if !seenVisit[e.Visit] {
			seenVisit[e.Visit] = true
			if firstYear == 0 || e.ISOYear < firstYear {
				firstYear = e.ISOYear
			}
			count(&closed, &running, e, stand.Year)
		}
		pair := [2]string{e.Visit, e.Species}
		if seenPair[pair] {
			continue
		}
		seenPair[pair] = true
		if a := arten[e.Species]; a != nil && e.Species != "" {
			a.visits++
			count(&a.closed, &a.running, e, stand.Year)
		}
	}
	out := pyjson.NewObj()
	for _, name := range latin {
		a := arten[name]
		out.Set(name, pyjson.O(
			"begehungenMitFund", a.visits,
			"fundeJeWoche", a.closed,
			"fundeJeWocheLaufendesJahr", a.running))
	}
	return pyjson.O(
		"standJahr", stand.Year,
		"standWoche", stand.Week,
		"vonJahr", firstYear,
		"bisJahr", stand.Year-1,
		"minArten", MinArten,
		"begehungenJeWoche", closed,
		"begehungenJeWocheLaufendesJahr", running,
		"arten", out), nil
}

// count adds a visit to the closed years or to the running year. A later year counts nowhere.
func count(closed, running *Series, e Entry, year int) {
	switch {
	case e.ISOYear < year:
		closed.add(e.ISOWeek)
	case e.ISOYear == year:
		running.add(e.ISOWeek)
	}
}

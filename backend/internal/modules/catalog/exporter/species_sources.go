package exporter

import (
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

// placeWords give a German word for the body part of a reagent change that the import reads back.
var placeWords = map[enums.BodyPart]string{
	enums.BodyPartFlesh: "Fleisch", enums.BodyPartCap: "Hut", enums.BodyPartStem: "Stiel",
	enums.BodyPartStemBase: "Stielbasis", enums.BodyPartTubes: "Röhren", enums.BodyPartPores: "Poren",
	enums.BodyPartGills: "Lamellen",
}

// reagents keeps each reagent text of the source file that gives a stored change, or that gives
// no change. A stored change without such a text gets a short new text.
func (s *speciesExport) reagents() []importer.Reagent {
	var rows []change
	for _, c := range s.db.Changes {
		if isReagent(c) {
			rows = append(rows, c)
		}
	}
	used := make([]bool, len(rows))
	var out []importer.Reagent
	var sourceWords []string
	for _, entry := range s.base.Reagenzien {
		sourceWords = append(sourceWords, entry.Reagenz)
		part, name, _, ok := importer.ReagentChange(entry.Reaktion, s.vocabulary)
		if !ok {
			out = append(out, entry)
			continue
		}
		slug := importer.ReagentSlug[entry.Reagenz]
		for i, row := range rows {
			if !used[i] && row.Triggers[0] == slug && row.Part == part && row.To.Name == name {
				used[i] = true
				out = append(out, entry)
				break
			}
		}
	}
	for i, row := range rows {
		if used[i] {
			continue
		}
		reagent, ok := word(importer.ReagentSlug, row.Triggers[0], sourceWords...)
		place, known := placeWords[row.Part]
		if !ok || !known {
			s.warn("reagent change %s on %s has no form in the seed format", row.Triggers[0], row.Part)
			continue
		}
		text := place + " " + row.To.Name
		if part, name, _, found := importer.ReagentChange(text, s.vocabulary); !found || part != row.Part || name != row.To.Name {
			s.warn("reagent text %q does not give the colour %s on import", text, row.To.Name)
		}
		out = append(out, importer.Reagent{Reagenz: reagent, Reaktion: text})
	}
	return out
}

func (s *speciesExport) sources(f *File) {
	var profile *importer.SourceRow
	links := []importer.Link{}
	for i, row := range s.db.Sources {
		if row.Scope == enums.SourceScopeProfile && profile == nil {
			profile = &s.db.Sources[i]
			continue
		}
		links = append(links, importer.Link{Titel: row.Title, URL: row.URL})
	}
	if profile == nil {
		s.warn("no profile source; the source of the seed file stays")
	} else {
		f.Quelle = importer.SourceEntry{Titel: profile.Title, URL: profile.URL, GeprueftAm: profile.CheckedOn.String()}
		if s.base.Quelle.Titel == "" && profile.Title == importer.HostTitle(profile.URL) {
			f.Quelle.Titel = ""
		}
		for _, row := range s.db.Sources {
			if row.CheckedOn != profile.CheckedOn {
				s.warn("source %q has its own check date; the seed format has one date", row.URL)
			}
		}
	}
	// The import skips a link to an address that came before, so these links stay at their place.
	seen := []string{s.base.Quelle.URL}
	for i, link := range s.base.Links {
		repeated := slices.ContainsFunc(seen, func(u string) bool { return importer.SameURL(u, link.URL) })
		seen = append(seen, link.URL)
		if !repeated {
			continue
		}
		at := min(i, len(links))
		before := append([]string{f.Quelle.URL}, urls(links[:at])...)
		if slices.ContainsFunc(before, func(u string) bool { return importer.SameURL(u, link.URL) }) {
			links = slices.Insert(links, at, link)
		}
	}
	f.Links = links
}

func urls(links []importer.Link) []string {
	out := make([]string, len(links))
	for i, l := range links {
		out[i] = l.URL
	}
	return out
}

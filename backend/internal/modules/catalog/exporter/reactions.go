package exporter

import (
	"context"
	"database/sql"
	"encoding/json"
	"io/fs"
	"reflect"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

// placeNames give the German place of daten/reaktionen.json that the import reads back.
var placeNames = map[string]string{
	"flesh": "Fleisch", "stem_base": "Stielbasis", "cap": "Hut", "stem": "Stiel", "gills": "Lamellen",
	"tubes": "Röhren", "pores": "Poren", "spore": "Sporen", "fruitbody": "Fruchtkörper", "milk": "Milch",
	"branches": "Äste", "branch_tips": "Astspitzen", "extract": "Extrakt",
}

// exportReactions writes the reactions of the database. The entries of a species stay as in the
// source file when they give the stored rows. Else the stored rows replace them.
func exportReactions(ctx context.Context, handle *sql.DB, base fs.FS, profiles []importer.StemProfile,
	c catalogue, report *Report) ([]byte, error) {
	members, err := readObject(base, importer.ReactionsFile)
	if err != nil {
		return nil, err
	}
	file, _, err := importer.LoadReactions(base)
	if err != nil {
		return nil, err
	}
	match, err := importer.SpeciesMatcher(ctx, handle, profiles)
	if err != nil {
		return nil, err
	}
	stored, err := storedReactions(ctx, handle)
	if err != nil {
		return nil, err
	}
	colours := importer.ColourVocabulary(profiles)
	speciesOf := func(e importer.ReactionEntry) (db.ID, bool) {
		id, found := match(e.Latin)
		_, known := importer.ReagentName[e.Reagent]
		return id, found && known
	}
	own := map[db.ID][]importer.ReactionEntry{}
	for _, entry := range file.Reactions {
		if species, ok := speciesOf(entry); ok {
			own[species] = append(own[species], entry)
		}
	}
	var entries []importer.ReactionEntry
	written, unchanged := map[db.ID]bool{}, map[db.ID]bool{}
	for _, entry := range file.Reactions {
		species, ok := speciesOf(entry)
		if !ok {
			entries = append(entries, entry)
			continue
		}
		same, known := unchanged[species]
		if !known {
			plan := importer.PlanReactions(importer.Reactions{Reactions: own[species]}, match, colours)
			same = sameRows(plan.Rows, stored[species])
			unchanged[species] = same
		}
		switch {
		case same:
			entries = append(entries, entry)
		case !written[species]:
			entries = append(entries, generated(c, species, stored[species])...)
		}
		written[species] = true
	}
	for _, s := range c.Species {
		if !written[s.Row.ID] {
			entries = append(entries, generated(c, s.Row.ID, stored[s.Row.ID])...)
		}
	}
	report.Reactions = len(entries)
	sources, err := reactionSources(ctx, handle, members)
	if err != nil {
		return nil, err
	}
	reactions, err := raw(orEmptyEntries(entries))
	if err != nil {
		return nil, err
	}
	list, err := raw(sources)
	if err != nil {
		return nil, err
	}
	return writeObject(setMember(setMember(members, "reactions", reactions), "sources", list))
}

func orEmptyEntries(entries []importer.ReactionEntry) []importer.ReactionEntry {
	if entries == nil {
		return []importer.ReactionEntry{}
	}
	return entries
}

func sameRows(planned, stored []importer.ReactionRow) bool {
	if len(planned) != len(stored) {
		return false
	}
	for i := range planned {
		a, b := planned[i], stored[i]
		a.SpeciesID, b.SpeciesID = db.ID{}, db.ID{}
		if !reflect.DeepEqual(a, b) {
			return false
		}
	}
	return true
}

// generated gives one entry for each stored row of a species.
func generated(c catalogue, species db.ID, rows []importer.ReactionRow) []importer.ReactionEntry {
	i := slices.IndexFunc(c.Species, func(s *stored) bool { return s.Row.ID == species })
	if i < 0 {
		return nil
	}
	row := c.Species[i].Row
	out := make([]importer.ReactionEntry, 0, len(rows))
	for _, r := range rows {
		entry := importer.ReactionEntry{
			Latin: row.LatinName, GermanName: row.Name, Reagent: r.Reagent, Reading: r.Reading,
			Result: r.Result, Contested: r.Contested, PartlyConfirmed: r.PartlyConfirmed,
			Sources: append([]string{}, r.SourceKeys...),
		}
		switch {
		case r.Part != nil:
			slug := string(*r.Part)
			entry.PartSlug = &slug
			if name, ok := placeNames[slug]; ok {
				entry.Part = &name
			}
		case r.Location != nil:
			entry.Part = placeText(*r.Location)
		}
		out = append(out, entry)
	}
	return out
}

// placeText gives the German words of a location of place slugs. Other text stays.
func placeText(location string) *string {
	slugs := strings.Split(location, importer.PlaceSeparator)
	words := make([]string, len(slugs))
	for i, slug := range slugs {
		name, ok := placeNames[slug]
		if !ok {
			return &location
		}
		words[i] = name
	}
	text := strings.Join(words, ", ")
	return &text
}

func storedReactions(ctx context.Context, handle *sql.DB) (map[db.ID][]importer.ReactionRow, error) {
	type link struct {
		species  db.ID
		position int
		key      string
	}
	links, err := db.All(ctx, handle, func(s db.Scanner) (link, error) {
		var l link
		return l, s.Scan(&l.species, &l.position, &l.key)
	}, `SELECT rs.species_id, rs.position, s."key" FROM species_reaction_source rs
		JOIN reaction_source s ON s.id = rs.source_id ORDER BY rs.rowid`)
	if err != nil {
		return nil, err
	}
	rows, err := db.All(ctx, handle, func(s db.Scanner) (importer.ReactionRow, error) {
		var r importer.ReactionRow
		var part *string
		err := s.Scan(&r.SpeciesID, &r.Position, &r.Reagent, &r.Reading, &part, &r.Location, &r.Result,
			&r.ColourName, &r.ColourHex, &r.Contested, &r.PartlyConfirmed)
		if part != nil {
			p := enums.BodyPart(*part)
			r.Part = &p
		}
		return r, err
	}, `SELECT r.species_id, r.position, t.slug, r.reading, r.part, r.location, r.result, r.colour_name,
		r.colour_hex, r.contested, r.partly_confirmed FROM species_reaction r JOIN term t ON t.id = r.term_id
		ORDER BY r.species_id, r.position`)
	if err != nil {
		return nil, err
	}
	out := map[db.ID][]importer.ReactionRow{}
	for _, r := range rows {
		for _, l := range links {
			if l.species == r.SpeciesID && l.position == r.Position {
				r.SourceKeys = append(r.SourceKeys, l.key)
			}
		}
		out[r.SpeciesID] = append(out[r.SpeciesID], r)
	}
	return out, nil
}

// sourceEntry is one source of daten/reaktionen.json. The database does not hold the other labels.
type sourceEntry struct {
	importer.ReactionSource
	AltLabels []string `json:"altLabels,omitempty"`
}

// reactionSources gives the sources of the database. The sources of the source file keep their order and their other labels.
func reactionSources(ctx context.Context, handle *sql.DB, members []member) ([]sourceEntry, error) {
	var source []sourceEntry
	for _, m := range members {
		if m.Key == "sources" {
			if err := json.Unmarshal(m.Value, &source); err != nil {
				return nil, err
			}
		}
	}
	rows, err := db.All(ctx, handle, func(s db.Scanner) (importer.ReactionSource, error) {
		var r importer.ReactionSource
		return r, s.Scan(&r.ID, &r.Label, &r.URL, &r.Year)
	}, `SELECT "key", label, url, year FROM reaction_source ORDER BY "key"`)
	if err != nil {
		return nil, err
	}
	out := []sourceEntry{}
	for _, s := range source {
		if i := slices.IndexFunc(rows, func(r importer.ReactionSource) bool { return r.ID == s.ID }); i >= 0 {
			s.ReactionSource = rows[i]
			out = append(out, s)
		}
	}
	for _, r := range rows {
		if !slices.ContainsFunc(out, func(o sourceEntry) bool { return o.ID == r.ID }) {
			out = append(out, sourceEntry{ReactionSource: r})
		}
	}
	return out, nil
}

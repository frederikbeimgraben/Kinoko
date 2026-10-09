package exporter

import (
	"context"
	"database/sql"
	"encoding/json"
	"io/fs"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/texts"
)

const glossaryFile = texts.GlossaryFile

// exportGlossary writes each glossary entry of the database. The entries of the source file keep
// their order, a new entry goes before the first entry with a later term.
func exportGlossary(ctx context.Context, handle *sql.DB, base fs.FS, report *Report) ([]byte, error) {
	members, err := readObject(base, glossaryFile)
	if err != nil {
		return nil, err
	}
	source, err := texts.ReadGlossary(base)
	if err != nil {
		return nil, err
	}
	rows, err := db.All(ctx, handle, func(s db.Scanner) (texts.GlossarySeedEntry, error) {
		var e texts.GlossarySeedEntry
		return e, s.Scan(&e.Term, &e.TermEn, &e.Definition, &e.DefinitionEn)
	}, "SELECT term, term_en, definition, definition_en FROM glossary_entry ORDER BY term")
	if err != nil {
		return nil, err
	}
	entries := []texts.GlossarySeedEntry{}
	for _, s := range source {
		if i := slices.IndexFunc(rows, func(r texts.GlossarySeedEntry) bool { return r.Term == s.Term }); i >= 0 {
			entries = append(entries, rows[i])
		}
	}
	for _, r := range rows {
		if slices.ContainsFunc(entries, func(e texts.GlossarySeedEntry) bool { return e.Term == r.Term }) {
			continue
		}
		at := slices.IndexFunc(entries, func(e texts.GlossarySeedEntry) bool { return e.Term > r.Term })
		if at < 0 {
			at = len(entries)
		}
		entries = slices.Insert(entries, at, r)
	}
	report.Glossary = len(entries)
	value, err := raw(entries)
	if err != nil {
		return nil, err
	}
	if members == nil {
		members = []member{{"source", json.RawMessage(`{"title":"Kinoko-Glossar"}`)}}
	}
	return writeObject(setMember(members, "entries", value))
}

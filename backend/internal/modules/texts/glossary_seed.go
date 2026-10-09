package texts

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// GlossaryFile is the seed file of the glossary in the data folder.
const GlossaryFile = "glossar.json"

// GlossarySeedEntry is one term of the glossary seed.
type GlossarySeedEntry struct {
	Term         string `json:"term"`
	TermEn       string `json:"termEn"`
	Definition   string `json:"definition"`
	DefinitionEn string `json:"definitionEn"`
}

type glossarySeed struct {
	Entries []GlossarySeedEntry `json:"entries"`
}

// ReadGlossary reads the glossary seed. Without the file the seed is empty.
func ReadGlossary(data fs.FS) ([]GlossarySeedEntry, error) {
	if data == nil {
		return nil, nil
	}
	raw, err := fs.ReadFile(data, GlossaryFile)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var parsed glossarySeed
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("read %s: %w", GlossaryFile, err)
	}
	return parsed.Entries, nil
}

// SeedGlossary adds each seed term one time and keeps the terms that no person changed equal to the seed.
// A term that a person changed or deleted stays as it is.
func SeedGlossary(ctx context.Context, handle *sql.DB, data fs.FS, now db.Time) (SeedReport, error) {
	entries, err := ReadGlossary(data)
	if err != nil || len(entries) == 0 {
		return SeedReport{}, err
	}
	return db.InTxValue(ctx, handle, func(tx *sql.Tx) (SeedReport, error) {
		seeded, err := db.All(ctx, tx, func(s db.Scanner) (string, error) {
			var term string
			return term, s.Scan(&term)
		}, `SELECT term FROM glossary_seed`)
		if err != nil {
			return SeedReport{}, err
		}
		rows, err := db.All(ctx, tx, scanGlossary, glossarySelect)
		if err != nil {
			return SeedReport{}, err
		}
		known := fn.Set(seeded)
		byTerm := fn.KeyBy(rows, func(r glossaryRow) string { return r.Term })
		report := SeedReport{}
		for _, entry := range entries {
			found, exists := byTerm[entry.Term]
			_, done := known[entry.Term]
			switch {
			case !exists && !done:
				report.Added++
				err = addSeedTerm(ctx, tx, entry, now)
			case exists && found.UpdatedBy == nil && !sameSeed(found.GlossaryEntry, entry):
				report.Updated++
				_, err = tx.ExecContext(ctx, `UPDATE glossary_entry SET term_en = ?, definition = ?, definition_en = ?,
					updated_at = ? WHERE id = ?`, entry.TermEn, entry.Definition, entry.DefinitionEn, now, found.ID)
			}
			if err != nil {
				return SeedReport{}, err
			}
			if _, err := tx.ExecContext(ctx, `INSERT INTO glossary_seed (term) VALUES (?) ON CONFLICT DO NOTHING`, entry.Term); err != nil {
				return SeedReport{}, err
			}
		}
		return report, nil
	})
}

func sameSeed(row GlossaryEntry, entry GlossarySeedEntry) bool {
	return row.TermEn == entry.TermEn && row.Definition == entry.Definition && row.DefinitionEn == entry.DefinitionEn
}

func addSeedTerm(ctx context.Context, tx *sql.Tx, entry GlossarySeedEntry, now db.Time) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO glossary_entry (id, term, term_en, definition, definition_en, updated_at,
		updated_by_id) VALUES (?, ?, ?, ?, ?, ?, NULL)`, db.NewID(), entry.Term, entry.TermEn, entry.Definition, entry.DefinitionEn, now)
	return err
}

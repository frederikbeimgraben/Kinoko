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

// SourceFile is the seed file of the texts in the data folder.
const SourceFile = "texte.json"

// Defaults are the seed texts: locale, then key, then value.
type Defaults map[string]map[string]string

// ValueOf gives the seed value of a key in a locale.
func (d Defaults) ValueOf(key, locale string) (string, bool) {
	value, ok := d[locale][key]
	return value, ok
}

// ReadDefaults reads the seed file. Without the file the catalogue stays empty.
func ReadDefaults(data fs.FS) (Defaults, error) {
	if data == nil {
		return Defaults{}, nil
	}
	raw, err := fs.ReadFile(data, SourceFile)
	if errors.Is(err, fs.ErrNotExist) {
		return Defaults{}, nil
	}
	if err != nil {
		return nil, err
	}
	var parsed Defaults
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("read %s: %w", SourceFile, err)
	}
	return parsed, nil
}

// SeedReport tells what a seed run did to the table.
type SeedReport struct {
	Added   int
	Updated int
	Removed int
}

// Touched is the count of all rows that the seed run changed.
func (r SeedReport) Touched() int { return r.Added + r.Updated + r.Removed }

type textKey struct{ key, locale string }

// seedPlan holds the changes that make the table agree with the seed.
type seedPlan struct {
	add    []textRow
	update []textRow
	remove []textKey
}

func (p seedPlan) report() SeedReport {
	return SeedReport{Added: len(p.add), Updated: len(p.update), Removed: len(p.remove)}
}

// planSeed compares the rows with the seed. A row that a person changed
// stays as it is, also when the seed does not have its key.
func planSeed(rows []textRow, defaults Defaults, now db.Time) seedPlan {
	byKey := fn.KeyBy(rows, func(r textRow) textKey { return textKey{r.Key, r.Locale} })
	plan := seedPlan{}
	for _, locale := range fn.SortedKeys(defaults) {
		entries := defaults[locale]
		for _, key := range fn.SortedKeys(entries) {
			value := entries[key]
			found, ok := byKey[textKey{key, locale}]
			switch {
			case !ok:
				plan.add = append(plan.add, textRow{Key: key, Locale: locale, Value: value, UpdatedAt: now})
			case found.UpdatedBy == nil && found.Value != value:
				plan.update = append(plan.update, textRow{Key: key, Locale: locale, Value: value, UpdatedAt: now})
			}
		}
	}
	for _, row := range rows {
		if _, known := defaults.ValueOf(row.Key, row.Locale); known || row.UpdatedBy != nil {
			continue
		}
		plan.remove = append(plan.remove, textKey{row.Key, row.Locale})
	}
	return plan
}

// Seed makes the table text agree with the seed file and tells what it did.
func Seed(ctx context.Context, handle *sql.DB, data fs.FS, now db.Time) (SeedReport, error) {
	defaults, err := ReadDefaults(data)
	if err != nil {
		return SeedReport{}, err
	}
	return db.InTxValue(ctx, handle, func(tx *sql.Tx) (SeedReport, error) {
		rows, err := allTexts(ctx, tx)
		if err != nil {
			return SeedReport{}, err
		}
		plan := planSeed(rows, defaults, now)
		return plan.report(), applySeed(ctx, tx, plan)
	})
}

func applySeed(ctx context.Context, tx *sql.Tx, plan seedPlan) error {
	for _, row := range plan.add {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO text ("key", locale, value, updated_at, updated_by_id) VALUES (?, ?, ?, ?, NULL)`,
			row.Key, row.Locale, row.Value, row.UpdatedAt); err != nil {
			return err
		}
	}
	for _, row := range plan.update {
		if _, err := tx.ExecContext(ctx,
			`UPDATE text SET value = ?, updated_at = ? WHERE "key" = ? AND locale = ?`,
			row.Value, row.UpdatedAt, row.Key, row.Locale); err != nil {
			return err
		}
	}
	for _, gone := range plan.remove {
		if _, err := tx.ExecContext(ctx,
			`DELETE FROM text WHERE "key" = ? AND locale = ?`, gone.key, gone.locale); err != nil {
			return err
		}
	}
	return nil
}

// LoadTitles gives the German texts of the error codes, by text key.
func LoadTitles(ctx context.Context, q db.Querier) (map[string]string, error) {
	rows, err := db.All(ctx, q, scanText, `SELECT `+textColumns+` FROM text
		WHERE locale = ? AND "key" LIKE ? || '%'`, defaultLocale, errorPrefix)
	if err != nil {
		return nil, err
	}
	return fn.Reduce(rows, map[string]string{}, func(acc map[string]string, r textRow) map[string]string {
		acc[r.Key] = r.Value
		return acc
	}), nil
}

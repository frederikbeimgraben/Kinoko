package texts

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

const (
	errorPrefix   = "error."
	defaultLocale = "de"
	textColumns   = `"key", locale, value, updated_at, updated_by_id`
)

// textRow is a row of the table text.
type textRow struct {
	Key       string
	Locale    string
	Value     string
	UpdatedAt db.Time
	UpdatedBy *db.ID
}

func scanText(s db.Scanner) (textRow, error) {
	var r textRow
	err := s.Scan(&r.Key, &r.Locale, &r.Value, &r.UpdatedAt, &r.UpdatedBy)
	return r, err
}

func allTexts(ctx context.Context, q db.Querier) ([]textRow, error) {
	return db.All(ctx, q, scanText, `SELECT `+textColumns+` FROM text ORDER BY "key", locale`)
}

// TextEntry is one key of the catalogue with the values of all its locales.
type TextEntry struct {
	Key       string            `json:"key"`
	Values    map[string]string `json:"values"`
	Changed   bool              `json:"changed"`
	UpdatedAt string            `json:"updatedAt"`
}

// Catalogue is the whole text catalogue.
type Catalogue struct {
	Revision string      `json:"revision"`
	Locales  []string    `json:"locales"`
	Entries  []TextEntry `json:"entries"`
}

// isoformat writes a UTC time in ISO 8601 with "+00:00" and without a zero fraction.
// The texts endpoint and its revision use this form.
func isoformat(t db.Time) string {
	u := t.UTC()
	if u.Nanosecond() == 0 {
		return u.Format("2006-01-02T15:04:05+00:00")
	}
	return u.Format("2006-01-02T15:04:05.000000+00:00")
}

func latest(rows []textRow) (db.Time, bool) {
	if len(rows) == 0 {
		return db.Time{}, false
	}
	return slices.MaxFunc(rows, func(a, b textRow) int { return a.UpdatedAt.Compare(b.UpdatedAt.Time) }).UpdatedAt, true
}

// revision is a fingerprint of the rows. It changes when a row is added,
// removed or written, because each write sets updated_at.
func revision(rows []textRow) string {
	stamp := ""
	if last, ok := latest(rows); ok {
		stamp = isoformat(last)
	}
	sum := sha256.Sum256(fmt.Appendf(nil, "%d:%s", len(rows), stamp))
	return hex.EncodeToString(sum[:])[:16]
}

// groupByKey keeps the order of the rows, which is by key and locale.
func groupByKey(rows []textRow) [][]textRow {
	return slices.Collect(func(yield func([]textRow) bool) {
		for start := 0; start < len(rows); {
			end := start + 1
			for end < len(rows) && rows[end].Key == rows[start].Key {
				end++
			}
			if !yield(rows[start:end]) {
				return
			}
			start = end
		}
	})
}

func entryOf(mine []textRow) TextEntry {
	last, _ := latest(mine)
	return TextEntry{
		Key: mine[0].Key,
		Values: fn.Reduce(mine, map[string]string{}, func(acc map[string]string, r textRow) map[string]string {
			acc[r.Locale] = r.Value
			return acc
		}),
		Changed:   fn.Any(mine, func(r textRow) bool { return r.UpdatedBy != nil }),
		UpdatedAt: isoformat(last),
	}
}

func catalogueOf(rows []textRow) Catalogue {
	return Catalogue{
		Revision: revision(rows),
		Locales:  append([]string{}, fn.SortedKeys(fn.Set(fn.Map(rows, func(r textRow) string { return r.Locale })))...),
		Entries:  fn.Map(groupByKey(rows), entryOf),
	}
}

func etagOf(c Catalogue) string { return `W/"` + c.Revision + `"` }

// Read gives the whole catalogue with its revision.
func Read(ctx context.Context, q db.Querier) (Catalogue, error) {
	rows, err := allTexts(ctx, q)
	if err != nil {
		return Catalogue{}, err
	}
	return catalogueOf(rows), nil
}

func (m *Module) listTexts(r *http.Request) (web.Response, error) {
	body, err := Read(r.Context(), m.deps.DB)
	if err != nil {
		return nil, err
	}
	header := http.Header{"Etag": {etagOf(body)}}
	if r.Header.Get("If-None-Match") == etagOf(body) {
		return web.EmptyWithHeader(http.StatusNotModified, header), nil
	}
	return web.JSONWithHeader(http.StatusOK, body, header), nil
}

type textWrite struct {
	Locale string `json:"locale"`
	Value  string `json:"value"`
}

func (m *Module) putText(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[textWrite](r)
	if err != nil {
		return nil, err
	}
	key, now, ctx := r.PathValue("key"), m.now(), r.Context()
	entry, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (TextEntry, error) {
		known, err := db.Scalar[bool](ctx, tx, `SELECT EXISTS (SELECT 1 FROM text WHERE "key" = ?)`, key)
		if err != nil {
			return TextEntry{}, err
		}
		if !known {
			return TextEntry{}, problem.NotFound()
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO text ("key", locale, value, updated_at, updated_by_id) VALUES (?, ?, ?, ?, ?)
			ON CONFLICT ("key", locale) DO UPDATE SET
				value = excluded.value, updated_at = excluded.updated_at, updated_by_id = excluded.updated_by_id`,
			key, body.Locale, body.Value, now, user.ID); err != nil {
			return TextEntry{}, err
		}
		mine, err := db.All(ctx, tx, scanText,
			`SELECT `+textColumns+` FROM text WHERE "key" = ? ORDER BY "key", locale`, key)
		if err != nil {
			return TextEntry{}, err
		}
		return entryOf(mine), nil
	})
	if err != nil {
		return nil, err
	}
	return web.OK(entry), nil
}

func (m *Module) resetText(r *http.Request) (web.Response, error) {
	key, locale := r.PathValue("key"), fn.Deref(web.Query(r, "locale"), "")
	defaults, err := ReadDefaults(m.deps.Data)
	if err != nil {
		return nil, err
	}
	err = Reset(r.Context(), m.deps.DB, defaults, key, locale, m.now())
	return nil, err
}

// Reset gives a text its seed value again. A text without a seed value is
// deleted. A missing row gives problem.NotFound.
func Reset(ctx context.Context, handle *sql.DB, defaults Defaults, key, locale string, now db.Time) error {
	return db.InTx(ctx, handle, func(tx *sql.Tx) error {
		_, found, err := db.Maybe(ctx, tx, scanText,
			`SELECT `+textColumns+` FROM text WHERE "key" = ? AND locale = ?`, key, locale)
		if err != nil {
			return err
		}
		if !found {
			return problem.NotFound()
		}
		fallback, ok := defaults.ValueOf(key, locale)
		if !ok {
			_, err = tx.ExecContext(ctx, `DELETE FROM text WHERE "key" = ? AND locale = ?`, key, locale)
			return err
		}
		_, err = tx.ExecContext(ctx,
			`UPDATE text SET value = ?, updated_by_id = NULL, updated_at = ? WHERE "key" = ? AND locale = ?`,
			fallback, now, key, locale)
		return err
	})
}

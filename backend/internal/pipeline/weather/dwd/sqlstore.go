package dwd

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

// SQLStore is a CacheStore over the table remote_cache_file (migration 0003).
type SQLStore struct{ DB *sql.DB }

const recordColumns = `source, "key", url, etag, last_modified, size_bytes, sha256,
	fetched_at, checked_at, state, error`

// Get returns the row of source and key.
func (s SQLStore) Get(ctx context.Context, source, key string) (CacheRecord, bool, error) {
	rec, ok, err := db.Maybe(ctx, s.DB, scanRecord,
		`SELECT `+recordColumns+` FROM remote_cache_file WHERE source = ? AND "key" = ?`, source, key)
	if err != nil {
		return CacheRecord{}, false, fmt.Errorf("dwd: read cache row %s %s: %w", source, key, err)
	}
	return rec, ok, nil
}

// Put inserts or replaces the row of rec.Source and rec.Key.
func (s SQLStore) Put(ctx context.Context, rec CacheRecord) error {
	_, err := db.Exec(ctx, s.DB, `INSERT INTO remote_cache_file (`+recordColumns+`)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (source, "key") DO UPDATE SET url = excluded.url, etag = excluded.etag,
			last_modified = excluded.last_modified, size_bytes = excluded.size_bytes,
			sha256 = excluded.sha256, fetched_at = excluded.fetched_at,
			checked_at = excluded.checked_at, state = excluded.state, error = excluded.error`,
		rec.Source, rec.Key, rec.URL, nullText(rec.ETag), nullText(rec.LastModified),
		rec.SizeBytes, nullText(rec.SHA256), nullTime(rec.FetchedAt), nullTime(rec.CheckedAt),
		rec.State, nullText(rec.Error))
	if err != nil {
		return fmt.Errorf("dwd: write cache row %s %s: %w", rec.Source, rec.Key, err)
	}
	return nil
}

// Delete removes the row of source and key.
func (s SQLStore) Delete(ctx context.Context, source, key string) error {
	if _, err := db.Exec(ctx, s.DB, `DELETE FROM remote_cache_file WHERE source = ? AND "key" = ?`,
		source, key); err != nil {
		return fmt.Errorf("dwd: delete cache row %s %s: %w", source, key, err)
	}
	return nil
}

// List returns the rows of source, sorted by key.
func (s SQLStore) List(ctx context.Context, source string) ([]CacheRecord, error) {
	recs, err := db.All(ctx, s.DB, scanRecord,
		`SELECT `+recordColumns+` FROM remote_cache_file WHERE source = ? ORDER BY "key"`, source)
	if err != nil {
		return nil, fmt.Errorf("dwd: list cache rows %s: %w", source, err)
	}
	return recs, nil
}

func scanRecord(row db.Scanner) (CacheRecord, error) {
	var rec CacheRecord
	var etag, lastMod, sha, errText sql.NullString
	var size sql.NullInt64
	var fetched, checked sql.Null[db.Time]
	err := row.Scan(&rec.Source, &rec.Key, &rec.URL, &etag, &lastMod, &size, &sha,
		&fetched, &checked, &rec.State, &errText)
	rec.ETag, rec.LastModified, rec.SHA256, rec.Error = etag.String, lastMod.String, sha.String, errText.String
	rec.SizeBytes = size.Int64
	rec.FetchedAt, rec.CheckedAt = fetched.V.Time, checked.V.Time
	return rec, err
}

func nullText(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nullTime(t time.Time) any {
	if t.IsZero() {
		return nil
	}
	return db.At(t)
}

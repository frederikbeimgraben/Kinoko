package db

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"slices"
	"strconv"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/migrations"
)

// alembicBaseline is the last revision of the old service. Its schema is
// identical to migration 1, so a database at this revision starts at 1.
const alembicBaseline = "baseline_4"

type migration struct {
	version int
	name    string
	sql     string
}

// Migrate applies each migration that the database does not have.
func Migrate(ctx context.Context, handle *sql.DB) error {
	all, err := loadMigrations(migrations.Files)
	if err != nil {
		return err
	}
	if err := ensureTable(ctx, handle); err != nil {
		return err
	}
	if err := adoptAlembic(ctx, handle); err != nil {
		return err
	}
	applied, err := Column[int](ctx, handle, "SELECT version FROM schema_migrations")
	if err != nil {
		return err
	}
	for _, m := range all {
		if slices.Contains(applied, m.version) {
			continue
		}
		if err := apply(ctx, handle, m); err != nil {
			return fmt.Errorf("migration %d %s: %w", m.version, m.name, err)
		}
	}
	return nil
}

func loadMigrations(files fs.FS) ([]migration, error) {
	names, err := fs.Glob(files, "*.sql")
	if err != nil {
		return nil, err
	}
	out := make([]migration, 0, len(names))
	for _, name := range names {
		number, label, ok := strings.Cut(strings.TrimSuffix(name, ".sql"), "_")
		if !ok {
			return nil, fmt.Errorf("migration %q has no number prefix", name)
		}
		version, err := strconv.Atoi(number)
		if err != nil {
			return nil, fmt.Errorf("migration %q: %w", name, err)
		}
		body, err := fs.ReadFile(files, name)
		if err != nil {
			return nil, err
		}
		out = append(out, migration{version: version, name: label, sql: string(body)})
	}
	slices.SortFunc(out, func(a, b migration) int { return a.version - b.version })
	return out, nil
}

func ensureTable(ctx context.Context, handle *sql.DB) error {
	_, err := handle.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER NOT NULL PRIMARY KEY,
		name TEXT NOT NULL,
		applied_at DATETIME NOT NULL
	)`)
	return err
}

func adoptAlembic(ctx context.Context, handle *sql.DB) error {
	exists, err := Scalar[int](ctx, handle,
		"SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = 'alembic_version'")
	if err != nil || exists == 0 {
		return err
	}
	revision, found, err := Maybe(ctx, handle, func(s Scanner) (string, error) {
		var value string
		return value, s.Scan(&value)
	}, "SELECT version_num FROM alembic_version")
	if err != nil {
		return err
	}
	if !found {
		return nil
	}
	if revision != alembicBaseline {
		return fmt.Errorf("database has alembic revision %q, expected %q", revision, alembicBaseline)
	}
	return InTx(ctx, handle, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx,
			"INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (1, 'baseline', ?)",
			Now()); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, "DROP TABLE alembic_version")
		return err
	})
}

func apply(ctx context.Context, handle *sql.DB, m migration) error {
	return InTx(ctx, handle, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, m.sql); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx,
			"INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
			m.version, m.name, Now())
		return err
	})
}

func migrationsFS() fs.FS { return migrations.Files }

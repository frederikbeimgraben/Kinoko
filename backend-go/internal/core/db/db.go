// Package db opens the SQLite database, applies the migrations and gives
// helpers that read rows into values.
package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"

	_ "modernc.org/sqlite"
)

// Querier is the part of *sql.DB and *sql.Tx that reads and writes.
type Querier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Scanner is the part of *sql.Row and *sql.Rows that reads columns.
type Scanner interface {
	Scan(dest ...any) error
}

// Open opens the database file and creates its folder when necessary.
// Each connection has foreign keys on and waits when another writer holds the lock.
func Open(path string) (*sql.DB, error) {
	if path != ":memory:" {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return nil, fmt.Errorf("create database folder: %w", err)
		}
	}
	query := url.Values{}
	query.Add("_pragma", "foreign_keys(1)")
	query.Add("_pragma", "busy_timeout(10000)")
	query.Add("_pragma", "journal_mode(WAL)")
	query.Add("_pragma", "synchronous(NORMAL)")
	query.Set("_txlock", "immediate")
	handle, err := sql.Open("sqlite", "file:"+path+"?"+query.Encode())
	if err != nil {
		return nil, err
	}
	if path == ":memory:" {
		handle.SetMaxOpenConns(1)
	}
	if err := handle.Ping(); err != nil {
		handle.Close()
		return nil, err
	}
	return handle, nil
}

// InTx runs f in one transaction. It commits when f returns no error.
func InTx(ctx context.Context, handle *sql.DB, f func(tx *sql.Tx) error) error {
	tx, err := handle.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := f(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// InTxValue runs f in one transaction and returns its value.
func InTxValue[T any](ctx context.Context, handle *sql.DB, f func(tx *sql.Tx) (T, error)) (T, error) {
	var out T
	err := InTx(ctx, handle, func(tx *sql.Tx) error {
		value, err := f(tx)
		out = value
		return err
	})
	return out, err
}

// All reads each row of the query with scan.
func All[T any](ctx context.Context, q Querier, scan func(Scanner) (T, error), query string, args ...any) ([]T, error) {
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []T{}
	for rows.Next() {
		value, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, value)
	}
	return out, rows.Err()
}

// One reads one row. Without a row it returns problem.NotFound.
func One[T any](ctx context.Context, q Querier, scan func(Scanner) (T, error), query string, args ...any) (T, error) {
	value, err := scan(q.QueryRowContext(ctx, query, args...))
	if errors.Is(err, sql.ErrNoRows) {
		return value, problem.NotFound()
	}
	return value, err
}

// Maybe reads one row. The bool is false when there is no row.
func Maybe[T any](ctx context.Context, q Querier, scan func(Scanner) (T, error), query string, args ...any) (T, bool, error) {
	value, err := scan(q.QueryRowContext(ctx, query, args...))
	if errors.Is(err, sql.ErrNoRows) {
		return value, false, nil
	}
	return value, err == nil, err
}

// Scalar reads one value of the first column.
func Scalar[T any](ctx context.Context, q Querier, query string, args ...any) (T, error) {
	var value T
	err := q.QueryRowContext(ctx, query, args...).Scan(&value)
	return value, err
}

// Column reads the first column of each row.
func Column[T any](ctx context.Context, q Querier, query string, args ...any) ([]T, error) {
	return All(ctx, q, func(s Scanner) (T, error) {
		var value T
		err := s.Scan(&value)
		return value, err
	}, query, args...)
}

// Exec runs a statement and returns the count of changed rows.
func Exec(ctx context.Context, q Querier, query string, args ...any) (int64, error) {
	result, err := q.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// Placeholders gives "?, ?, ?" for n values.
func Placeholders(n int) string {
	if n <= 0 {
		return ""
	}
	out := make([]byte, 0, n*3)
	for i := range n {
		if i > 0 {
			out = append(out, ", "...)
		}
		out = append(out, '?')
	}
	return string(out)
}

// Args converts a slice into arguments for a query.
func Args[T any](values []T) []any {
	out := make([]any, len(values))
	for i, value := range values {
		out[i] = value
	}
	return out
}

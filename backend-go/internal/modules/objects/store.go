package objects

import (
	"context"
	"database/sql"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/paging"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// owned holds the columns that each table with an owner has.
type owned struct {
	ID        db.ID
	OwnerID   db.ID
	CreatedAt db.Time
	UpdatedAt db.Time
	DeletedAt *db.Time
}

// column is one column and the value to write into it.
type column struct {
	name  string
	value any
}

// kind describes one table with an owner: find, marker, zone or combination.
type kind[T any] struct {
	table    string
	columns  string
	scan     func(db.Scanner) (T, error)
	meta     func(T) owned
	inserted []column
}

func (k kind[T]) get(ctx context.Context, q db.Querier, id db.ID) (T, bool, error) {
	return db.Maybe(ctx, q, k.scan, "SELECT "+k.columns+" FROM "+k.table+" WHERE id = ?", id)
}

// own gives a row of the person that is not deleted. Other rows are not found.
func (k kind[T]) own(ctx context.Context, q db.Querier, user, id db.ID) (T, error) {
	row, found, err := k.get(ctx, q, id)
	if err != nil {
		return row, err
	}
	meta := k.meta(row)
	if !found || meta.OwnerID != user || meta.DeletedAt != nil {
		return row, problem.NotFound()
	}
	return row, nil
}

// filter is an SQL condition with its arguments.
type filter struct {
	sql  string
	args []any
}

func where(filters []filter) (string, []any) {
	return strings.Join(fn.Map(filters, func(f filter) string { return f.sql }), " AND "),
		fn.FlatMap(filters, func(f filter) []any { return f.args })
}

// page reads one page of rows. The queries of the old service have no
// ORDER BY, so these have none: SQLite then gives the same order.
func (k kind[T]) page(ctx context.Context, q db.Querier, p paging.Paging, filters ...filter) ([]T, error) {
	condition, args := where(filters)
	limit, offset := p.SQL()
	return db.All(ctx, q, k.scan,
		"SELECT "+k.columns+" FROM "+k.table+" WHERE "+condition+" LIMIT ? OFFSET ?",
		append(args, limit, offset)...)
}

// mine gives the rows of the person: without since the rows that are not
// deleted, with since each row changed after it, deleted ones too.
func (k kind[T]) mine(ctx context.Context, q db.Querier, user db.ID, since *db.Time, p paging.Paging, more ...filter) ([]T, error) {
	base := []filter{{"owner_id = ?", []any{user}}, {"deleted_at IS NULL", nil}}
	if since != nil {
		base = []filter{{"owner_id = ?", []any{user}}, {"updated_at > ?", []any{*since}}}
	}
	return k.page(ctx, q, p, append(base, more...)...)
}

func (k kind[T]) insert(ctx context.Context, q db.Querier, id, owner db.ID, values []column, now db.Time) error {
	all := append(append(append([]column{{"id", id}, {"owner_id", owner}}, values...), k.inserted...),
		column{"created_at", now}, column{"updated_at", now})
	_, err := q.ExecContext(ctx,
		"INSERT INTO "+k.table+" ("+strings.Join(fn.Map(all, func(c column) string { return c.name }), ", ")+
			") VALUES ("+db.Placeholders(len(all))+")",
		fn.Map(all, func(c column) any { return c.value })...)
	return err
}

func (k kind[T]) set(ctx context.Context, q db.Querier, id db.ID, values []column) error {
	_, err := q.ExecContext(ctx,
		"UPDATE "+k.table+" SET "+strings.Join(fn.Map(values, func(c column) string { return c.name + " = ?" }), ", ")+
			" WHERE id = ?",
		append(fn.Map(values, func(c column) any { return c.value }), id)...)
	return err
}

// create adds a row with a new key.
func (k kind[T]) create(ctx context.Context, handle *sql.DB, owner db.ID, values []column, now db.Time) (T, error) {
	return db.InTxValue(ctx, handle, func(tx *sql.Tx) (T, error) {
		id := db.NewID()
		if err := k.insert(ctx, tx, id, owner, values, now); err != nil {
			var zero T
			return zero, err
		}
		row, _, err := k.get(ctx, tx, id)
		return row, err
	})
}

type upserted[T any] struct {
	row     T
	created bool
}

// upsert adds the row with this key, or replaces it. A row of another
// person is not found. A deleted row comes back and counts as created.
func (k kind[T]) upsert(ctx context.Context, handle *sql.DB, owner, id db.ID, values []column, now db.Time) (upserted[T], error) {
	return db.InTxValue(ctx, handle, func(tx *sql.Tx) (upserted[T], error) {
		found, ok, err := k.get(ctx, tx, id)
		if err != nil {
			return upserted[T]{}, err
		}
		meta := k.meta(found)
		created := !ok
		switch {
		case ok && meta.OwnerID != owner:
			return upserted[T]{}, problem.NotFound()
		case !ok:
			err = k.insert(ctx, tx, id, owner, values, now)
		default:
			changes := append(append([]column{}, values...), column{"updated_at", now})
			if meta.DeletedAt != nil {
				changes = append(changes, column{"deleted_at", nil})
				created = true
			}
			err = k.set(ctx, tx, id, changes)
		}
		if err != nil {
			return upserted[T]{}, err
		}
		row, _, err := k.get(ctx, tx, id)
		return upserted[T]{row: row, created: created}, err
	})
}

// remove deletes an own row softly: it keeps the row for the sync of devices.
func (k kind[T]) remove(ctx context.Context, handle *sql.DB, owner, id db.ID, now db.Time) error {
	return db.InTx(ctx, handle, func(tx *sql.Tx) error {
		if _, err := k.own(ctx, tx, owner, id); err != nil {
			return err
		}
		return k.set(ctx, tx, id, []column{{"deleted_at", now}, {"updated_at", now}})
	})
}

// pageOf builds the answer of a list from rows with one row more than the page.
func pageOf[T, O any](rows []T, p paging.Paging, out func(T) O) paging.Page[O] {
	wrapped := paging.Wrap(rows, p)
	return paging.Page[O]{Items: fn.Map(wrapped.Items, out), NextCursor: wrapped.NextCursor}
}

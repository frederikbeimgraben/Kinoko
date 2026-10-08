package texts

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// GlossaryEntry is one term of the glossary.
type GlossaryEntry struct {
	ID            db.ID   `json:"id"`
	Term          string  `json:"term"`
	Definition    string  `json:"definition"`
	UpdatedByName *string `json:"updatedByName"`
	UpdatedAt     db.Time `json:"updatedAt"`
}

type glossaryRow struct {
	GlossaryEntry
	UpdatedBy *db.ID
}

type glossaryList struct {
	Items []GlossaryEntry `json:"items"`
}

type glossaryWrite struct {
	Term       string `json:"term"`
	Definition string `json:"definition"`
}

const glossarySelect = `SELECT g.id, g.term, g.definition, u.name, g.updated_at, g.updated_by_id
	FROM glossary_entry g LEFT JOIN user u ON u.id = g.updated_by_id`

func scanGlossary(s db.Scanner) (glossaryRow, error) {
	var r glossaryRow
	err := s.Scan(&r.ID, &r.Term, &r.Definition, &r.UpdatedByName, &r.UpdatedAt, &r.UpdatedBy)
	return r, err
}

func glossaryByID(ctx context.Context, q db.Querier, id db.ID) (glossaryRow, error) {
	return db.One(ctx, q, scanGlossary, glossarySelect+` WHERE g.id = ?`, id)
}

// termTaken tells if another entry has the term.
func termTaken(ctx context.Context, q db.Querier, term string, without *db.ID) (bool, error) {
	if without == nil {
		return db.Scalar[bool](ctx, q, `SELECT EXISTS (SELECT 1 FROM glossary_entry WHERE term = ?)`, term)
	}
	return db.Scalar[bool](ctx, q,
		`SELECT EXISTS (SELECT 1 FROM glossary_entry WHERE term = ? AND id != ?)`, term, *without)
}

func takenProblem() error { return problem.InvalidField("term", "taken") }

func (m *Module) listGlossary(r *http.Request) (web.Response, error) {
	rows, err := db.All(r.Context(), m.deps.DB, scanGlossary, glossarySelect+` ORDER BY g.term`)
	if err != nil {
		return nil, err
	}
	items := fn.Map(rows, func(row glossaryRow) GlossaryEntry { return row.GlossaryEntry })
	return web.OK(glossaryList{Items: items}), nil
}

func (m *Module) createGlossaryEntry(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[glossaryWrite](r)
	if err != nil {
		return nil, err
	}
	ctx, now := r.Context(), m.now()
	made, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (glossaryRow, error) {
		taken, err := termTaken(ctx, tx, body.Term, nil)
		if err != nil {
			return glossaryRow{}, err
		}
		if taken {
			return glossaryRow{}, takenProblem()
		}
		id := db.NewID()
		if _, err := tx.ExecContext(ctx, `INSERT INTO glossary_entry
			(id, term, definition, updated_at, updated_by_id) VALUES (?, ?, ?, ?, ?)`,
			id, body.Term, body.Definition, now, user.ID); err != nil {
			return glossaryRow{}, err
		}
		return glossaryByID(ctx, tx, id)
	})
	if err != nil {
		return nil, err
	}
	return web.Created(made.GlossaryEntry), nil
}

// unchanged tells if a write keeps each value of the row. The Python service
// then writes nothing, so updated_at stays as it is.
func unchanged(row glossaryRow, body glossaryWrite, user db.ID) bool {
	return row.Term == body.Term && row.Definition == body.Definition &&
		row.UpdatedBy != nil && *row.UpdatedBy == user
}

func (m *Module) updateGlossaryEntry(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[glossaryWrite](r)
	if err != nil {
		return nil, err
	}
	ctx, now := r.Context(), m.now()
	saved, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (glossaryRow, error) {
		found, err := glossaryByID(ctx, tx, id)
		if err != nil {
			return glossaryRow{}, err
		}
		taken, err := termTaken(ctx, tx, body.Term, &id)
		if err != nil {
			return glossaryRow{}, err
		}
		if taken {
			return glossaryRow{}, takenProblem()
		}
		if unchanged(found, body, user.ID) {
			return found, nil
		}
		if _, err := tx.ExecContext(ctx, `UPDATE glossary_entry
			SET term = ?, definition = ?, updated_by_id = ?, updated_at = ? WHERE id = ?`,
			body.Term, body.Definition, user.ID, now, id); err != nil {
			return glossaryRow{}, err
		}
		return glossaryByID(ctx, tx, id)
	})
	if err != nil {
		return nil, err
	}
	return web.OK(saved.GlossaryEntry), nil
}

func (m *Module) deleteGlossaryEntry(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	removed, err := db.Exec(r.Context(), m.deps.DB, `DELETE FROM glossary_entry WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	if removed == 0 {
		return nil, problem.NotFound()
	}
	return web.Empty(http.StatusNoContent), nil
}

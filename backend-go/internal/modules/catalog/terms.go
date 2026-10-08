package catalog

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// Term is a term of the catalogue.
type Term struct {
	ID       db.ID               `json:"id"`
	Kind     enums.TermKind      `json:"kind"`
	Group    *enums.TriggerGroup `json:"group"`
	Slug     string              `json:"slug"`
	Name     string              `json:"name"`
	Position int                 `json:"position"`
}

func termOut(t termRow) Term { return Term(t) }

func (m *Module) listTerms(r *http.Request) (web.Response, error) {
	query := "SELECT " + termCols + " FROM term"
	args := []any{}
	if kind := r.URL.Query().Get("kind"); kind != "" {
		query += " WHERE kind = ?"
		args = append(args, kind)
	}
	rows, err := db.All(r.Context(), m.deps.DB, scanTerm, query+" ORDER BY position, name", args...)
	if err != nil {
		return nil, err
	}
	return web.OK(map[string][]Term{"items": fn.Map(rows, termOut)}), nil
}

type termCreate struct {
	Kind     enums.TermKind      `json:"kind"`
	Group    *enums.TriggerGroup `json:"group"`
	Slug     string              `json:"slug"`
	Name     string              `json:"name"`
	Position int                 `json:"position"`
}

func (m *Module) createTerm(r *http.Request) (web.Response, error) {
	body, err := web.Decode[termCreate](r)
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	made, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (termRow, error) {
		taken, err := db.Scalar[int](ctx, tx, "SELECT count(*) FROM term WHERE kind = ? AND slug = ?", body.Kind, body.Slug)
		if err != nil {
			return termRow{}, err
		}
		if taken > 0 {
			return termRow{}, problem.Conflict("slug_taken", "")
		}
		row := termRow{db.NewID(), body.Kind, body.Group, body.Slug, body.Name, body.Position}
		_, err = tx.ExecContext(ctx, "INSERT INTO term ("+termCols+") VALUES (?, ?, ?, ?, ?, ?)",
			row.ID, row.Kind, row.Group, row.Slug, row.Name, row.Position)
		return row, err
	})
	if err != nil {
		return nil, err
	}
	return web.Created(termOut(made)), nil
}

func termByID(ctx context.Context, q db.Querier, id db.ID) (termRow, error) {
	return db.One(ctx, q, scanTerm, "SELECT "+termCols+" FROM term WHERE id = ?", id)
}

// updateTerm changes only the fields that the body has.
func (m *Module) updateTerm(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[map[string]json.RawMessage](r)
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	changed, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (termRow, error) {
		row, err := termByID(ctx, tx, id)
		if err != nil {
			return termRow{}, err
		}
		if raw, ok := body["name"]; ok {
			if err := json.Unmarshal(raw, &row.Name); err != nil {
				return termRow{}, problem.InvalidField("name", "string_type")
			}
		}
		if raw, ok := body["group"]; ok {
			row.Group = nil
			if err := json.Unmarshal(raw, &row.Group); err != nil {
				return termRow{}, problem.InvalidField("group", "enum")
			}
		}
		if raw, ok := body["position"]; ok {
			if err := json.Unmarshal(raw, &row.Position); err != nil {
				return termRow{}, problem.InvalidField("position", "int_parsing")
			}
		}
		_, err = tx.ExecContext(ctx, "UPDATE term SET name = ?, group_key = ?, position = ? WHERE id = ?",
			row.Name, row.Group, row.Position, row.ID)
		return row, err
	})
	if err != nil {
		return nil, err
	}
	return web.OK(termOut(changed)), nil
}

// deleteTerm removes the term. The cascades remove its uses, reactions included.
func (m *Module) deleteTerm(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	err = db.InTx(ctx, m.deps.DB, func(tx *sql.Tx) error {
		if _, err := termByID(ctx, tx, id); err != nil {
			return err
		}
		return execAll(ctx, tx, []statement{
			{"DELETE FROM species_term WHERE term_id = ?", []any{id}},
			{"DELETE FROM species_colour_change_trigger WHERE term_id = ?", []any{id}},
			{"DELETE FROM term WHERE id = ?", []any{id}},
		})
	})
	if err != nil {
		return nil, err
	}
	return web.Empty(http.StatusNoContent), nil
}

type mergeWrite struct {
	Into db.ID `json:"into"`
}

// mergeTerms moves each use of a term to the target and drops the uses
// that the target has already. Reactions move too, so they stay.
func mergeTerms(from, into db.ID) []statement {
	return []statement{
		{`DELETE FROM species_term WHERE term_id = ? AND species_id IN
			(SELECT species_id FROM species_term WHERE term_id = ?)`, []any{from, into}},
		{"UPDATE species_term SET term_id = ? WHERE term_id = ?", []any{into, from}},
		{`DELETE FROM species_colour_change_trigger WHERE term_id = ? AND EXISTS
			(SELECT 1 FROM species_colour_change_trigger t WHERE t.term_id = ?
			AND t.species_id = species_colour_change_trigger.species_id
			AND t.position = species_colour_change_trigger.position)`, []any{from, into}},
		{"UPDATE species_colour_change_trigger SET term_id = ? WHERE term_id = ?", []any{into, from}},
		{"UPDATE species_reaction SET term_id = ? WHERE term_id = ?", []any{into, from}},
		{"DELETE FROM term WHERE id = ?", []any{from}},
	}
}

func (m *Module) mergeTerm(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[mergeWrite](r)
	if err != nil {
		return nil, err
	}
	if id == body.Into {
		return nil, problem.InvalidField("into", "self_merge")
	}
	ctx := r.Context()
	err = db.InTx(ctx, m.deps.DB, func(tx *sql.Tx) error {
		if _, err := termByID(ctx, tx, id); err != nil {
			return err
		}
		if _, err := termByID(ctx, tx, body.Into); err != nil {
			return err
		}
		return execAll(ctx, tx, mergeTerms(id, body.Into))
	})
	if err != nil {
		return nil, err
	}
	return web.Empty(http.StatusNoContent), nil
}

func execAll(ctx context.Context, tx *sql.Tx, statements []statement) error {
	for _, s := range statements {
		if _, err := tx.ExecContext(ctx, s.query, s.args...); err != nil {
			return err
		}
	}
	return nil
}

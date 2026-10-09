package photos

import (
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
)

// reopen takes back an approval or a rejection, for the undo of the review queue.
// The photo loses its lead mark: the species then falls back to its oldest approved photo.
func (m *Module) reopen(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	now := db.At(m.deps.Now())
	changed, err := db.Exec(r.Context(), m.deps.DB, `UPDATE photo SET state = 'submitted',
		reviewed_by_id = NULL, reviewed_at = NULL, reject_reason = NULL, lead = 0, updated_at = ?
		WHERE id = ? AND state IN ('approved', 'rejected')`, now, id)
	if err != nil {
		return nil, err
	}
	if changed == 0 {
		exists, err := db.Scalar[bool](r.Context(), m.deps.DB, "SELECT EXISTS (SELECT 1 FROM photo WHERE id = ?)", id)
		if err != nil {
			return nil, err
		}
		if !exists {
			return nil, problem.NotFound()
		}
		return nil, problem.Conflict("", "")
	}
	return m.answer(r.Context(), id)
}

package objects

import (
	"database/sql"
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/paging"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
)

// reopenFind takes back an acceptance or a rejection, for the undo of the review queue.
// The find is open again and has no reviewer.
func (m *Module) reopenFind(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	now := m.now()
	row, err := db.InTxValue(r.Context(), m.deps.DB, func(tx *sql.Tx) (findRow, error) {
		row, found, err := finds.get(r.Context(), tx, id)
		switch {
		case err != nil:
			return findRow{}, err
		case !found:
			return findRow{}, problem.NotFound()
		case row.ReviewState == enums.ReviewStateOpen:
			return findRow{}, problem.Conflict("", "")
		}
		if err := finds.set(r.Context(), tx, id, []column{
			{"review_state", enums.ReviewStateOpen}, {"reviewed_by_id", nil},
			{"reviewed_at", nil}, {"updated_at", now},
		}); err != nil {
			return findRow{}, err
		}
		row, _, err = finds.get(r.Context(), tx, id)
		return row, err
	})
	if err != nil {
		return nil, err
	}
	return web.OK(exactFind(row)), nil
}

// ownerNameColumn is the display name of the owner of a find: the name, else the
// email, else the subject, as the group member lists show it.
const ownerNameColumn = `(SELECT COALESCE(NULLIF(user.name, ''), NULLIF(user.email, ''), user.sub)
	FROM user WHERE user.id = find.owner_id)`

// openFindRow is a find in review with the display name of its owner.
type openFindRow struct {
	findRow
	OwnerName *string
}

// openFindOut is a find in review. The reviewer sees who reported it.
type openFindOut struct {
	findOut
	OwnerName *string `json:"ownerName"`
}

// withOwnerName reads one more column after the columns of a find.
type withOwnerName struct {
	db.Scanner
	name **string
}

func (s withOwnerName) Scan(dest ...any) error { return s.Scanner.Scan(append(dest, s.name)...) }

func scanOpenFind(s db.Scanner) (openFindRow, error) {
	var row openFindRow
	find, err := finds.scan(withOwnerName{Scanner: s, name: &row.OwnerName})
	row.findRow = find
	return row, err
}

func openFindOf(row openFindRow) openFindOut {
	return openFindOut{findOut: exactFind(row.findRow), OwnerName: row.OwnerName}
}

func (m *Module) openFinds(r *http.Request) (web.Response, error) {
	p, err := paging.FromRequest(r, paging.MaxLimit)
	if err != nil {
		return nil, err
	}
	limit, offset := p.SQL()
	rows, err := db.All(r.Context(), m.deps.DB, scanOpenFind,
		"SELECT "+finds.columns+", "+ownerNameColumn+" FROM find WHERE review_state = ? AND deleted_at IS NULL "+
			"ORDER BY created_at LIMIT ? OFFSET ?", enums.ReviewStateOpen, limit, offset)
	if err != nil {
		return nil, err
	}
	return web.OK(pageOf(rows, p, openFindOf)), nil
}

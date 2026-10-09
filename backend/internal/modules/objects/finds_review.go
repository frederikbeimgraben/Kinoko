package objects

import (
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/paging"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
)

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

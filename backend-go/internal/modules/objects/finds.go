package objects

import (
	"context"
	"database/sql"
	"maps"
	"net/http"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/paging"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/shared"
)

// coarseKm is the grid of the places of protected species in shared lists.
const coarseKm = 1.0

type findRow struct {
	owned
	SpeciesID    *db.ID
	Lat, Lon     float64
	FoundOn      db.Date
	Count        *int
	ForTraining  bool
	ReviewState  enums.ReviewState
	ReviewedByID *db.ID
	ReviewedAt   *db.Time
	Visibility   enums.Visibility
	GroupID      *db.ID
	Note         *string
}

var finds = kind[findRow]{
	table: "find",
	columns: "id, owner_id, species_id, lat, lon, found_on, count, for_training, review_state, " +
		"reviewed_by_id, reviewed_at, visibility, group_id, note, created_at, updated_at, deleted_at",
	scan: func(s db.Scanner) (findRow, error) {
		var f findRow
		err := s.Scan(&f.ID, &f.OwnerID, &f.SpeciesID, &f.Lat, &f.Lon, &f.FoundOn, &f.Count, &f.ForTraining,
			&f.ReviewState, &f.ReviewedByID, &f.ReviewedAt, &f.Visibility, &f.GroupID, &f.Note,
			&f.CreatedAt, &f.UpdatedAt, &f.DeletedAt)
		return f, err
	},
	meta:     func(f findRow) owned { return f.owned },
	inserted: []column{{"review_state", enums.ReviewStateOpen}},
}

// findOut is a find in the order of the old schema.
type findOut struct {
	ID           db.ID             `json:"id"`
	OwnerID      db.ID             `json:"ownerId"`
	SpeciesID    *db.ID            `json:"speciesId"`
	Lat          float64           `json:"lat"`
	Lon          float64           `json:"lon"`
	FoundOn      db.Date           `json:"foundOn"`
	Count        *int              `json:"count"`
	ForTraining  bool              `json:"forTraining"`
	ReviewState  enums.ReviewState `json:"reviewState"`
	ReviewedByID *db.ID            `json:"reviewedById"`
	ReviewedAt   *db.Time          `json:"reviewedAt"`
	Visibility   enums.Visibility  `json:"visibility"`
	GroupID      *db.ID            `json:"groupId"`
	Note         *string           `json:"note"`
	CreatedAt    db.Time           `json:"createdAt"`
	UpdatedAt    db.Time           `json:"updatedAt"`
	Deleted      bool              `json:"deleted"`
}

// findOf builds the answer. With coarse the place moves to a 1 km grid.
func findOf(f findRow, coarse bool) findOut {
	place := geo.Point{Lon: f.Lon, Lat: f.Lat}
	if coarse {
		place = geo.Coarse(place, coarseKm)
	}
	return findOut{
		ID: f.ID, OwnerID: f.OwnerID, SpeciesID: f.SpeciesID, Lat: place.Lat, Lon: place.Lon,
		FoundOn: f.FoundOn, Count: f.Count, ForTraining: f.ForTraining, ReviewState: f.ReviewState,
		ReviewedByID: f.ReviewedByID, ReviewedAt: f.ReviewedAt, Visibility: f.Visibility,
		GroupID: f.GroupID, Note: f.Note, CreatedAt: f.CreatedAt, UpdatedAt: f.UpdatedAt,
		Deleted: f.DeletedAt != nil,
	}
}

func exactFind(f findRow) findOut { return findOf(f, false) }

type findWrite struct {
	SpeciesID   *db.ID            `json:"speciesId"`
	Lat         float64           `json:"lat"`
	Lon         float64           `json:"lon"`
	FoundOn     db.Date           `json:"foundOn"`
	Count       *laxInt           `json:"count"`
	ForTraining bool              `json:"forTraining"`
	Visibility  *enums.Visibility `json:"visibility"`
	GroupID     *db.ID            `json:"groupId"`
	Note        *string           `json:"note"`
}

func (m *Module) findValues(r *http.Request) func(db.ID) ([]column, error) {
	return func(user db.ID) ([]column, error) {
		body, err := web.Decode[findWrite](r)
		if err != nil {
			return nil, err
		}
		visibility := visibilityOr(body.Visibility)
		group, err := m.groupOf(r.Context(), user, visibility, body.GroupID)
		if err != nil {
			return nil, err
		}
		var count *int
		if body.Count != nil {
			count = fn.Ptr(int(*body.Count))
		}
		return []column{
			{"species_id", body.SpeciesID}, {"lat", body.Lat}, {"lon", body.Lon},
			{"found_on", body.FoundOn}, {"count", count}, {"for_training", body.ForTraining},
			{"visibility", visibility}, {"group_id", group}, {"note", body.Note},
		}, nil
	}
}

// findQuery is the filter of the find list.
type findQuery struct {
	mine    bool
	species *db.ID
	box     *geo.Box
	since   *db.Time
}

func findQueryOf(r *http.Request) (findQuery, error) {
	mine, err := boolOf(r, "mine", true)
	if err != nil {
		return findQuery{}, err
	}
	species, err := idOf(r, "speciesId")
	if err != nil {
		return findQuery{}, err
	}
	var box *geo.Box
	if raw := web.Query(r, "bbox"); raw != nil && *raw != "" {
		parsed, ok := geo.ParseBox(*raw)
		if !ok {
			return findQuery{}, problem.InvalidField("bbox", "bbox")
		}
		box = &parsed
	}
	since, err := sinceOf(r)
	return findQuery{mine: mine, species: species, box: box, since: since}, err
}

func (q findQuery) filters() []filter {
	out := []filter{}
	if q.species != nil {
		out = append(out, filter{"species_id = ?", []any{*q.species}})
	}
	if q.box != nil {
		out = append(out, filter{"lon BETWEEN ? AND ? AND lat BETWEEN ? AND ?",
			[]any{q.box.West, q.box.East, q.box.South, q.box.North}})
	}
	return out
}

func (m *Module) listFinds(r *http.Request) (web.Response, error) {
	viewer, err := auth.From(r)
	if err != nil {
		return nil, err
	}
	p, err := paging.FromRequest(r, paging.MaxLimit)
	if err != nil {
		return nil, err
	}
	query, err := findQueryOf(r)
	if err != nil {
		return nil, err
	}
	if !query.mine {
		return m.sharedFinds(r.Context(), viewer, p, query)
	}
	if viewer.User == nil {
		return nil, problem.Unauthorized()
	}
	rows, err := finds.mine(r.Context(), m.deps.DB, viewer.User.ID, query.since, p, query.filters()...)
	if err != nil {
		return nil, err
	}
	return web.OK(pageOf(rows, p, exactFind)), nil
}

// sharedFinds lists the finds of the groups of the viewer, without the own
// finds. The place of a protected species moves to a 1 km grid.
func (m *Module) sharedFinds(ctx context.Context, viewer auth.Viewer, p paging.Paging, query findQuery) (web.Response, error) {
	held := map[db.ID]struct{}{}
	if viewer.User != nil {
		var err error
		if held, err = shared.MemberGroupIDs(ctx, m.deps.DB, viewer.User.ID); err != nil {
			return nil, err
		}
	}
	if len(held) == 0 {
		return web.OK(pageOf([]findRow{}, p, exactFind)), nil
	}
	groups := fn.SortedBy(slices.Collect(maps.Keys(held)), db.ID.String)
	filters := []filter{
		{"visibility = ?", []any{enums.VisibilityShared}},
		{"group_id IN (" + db.Placeholders(len(groups)) + ")", db.Args(groups)},
		{"deleted_at IS NULL", nil},
		{"owner_id != ?", []any{viewer.User.ID}},
	}
	if query.since != nil {
		filters = append(filters, filter{"updated_at > ?", []any{*query.since}})
	}
	rows, err := finds.page(ctx, m.deps.DB, p, append(filters, query.filters()...)...)
	if err != nil {
		return nil, err
	}
	levels, err := protections(ctx, m.deps.DB, rows)
	if err != nil {
		return nil, err
	}
	return web.OK(pageOf(rows, p, func(f findRow) findOut {
		level, known := enums.ProtectionNone, false
		if f.SpeciesID != nil {
			level, known = levels[*f.SpeciesID]
		}
		return findOf(f, known && level != enums.ProtectionNone)
	})), nil
}

type protection struct {
	id    db.ID
	level enums.Protection
}

func protections(ctx context.Context, q db.Querier, rows []findRow) (map[db.ID]enums.Protection, error) {
	ids := slices.Collect(maps.Keys(fn.Set(fn.FlatMap(rows, func(f findRow) []db.ID {
		if f.SpeciesID == nil {
			return nil
		}
		return []db.ID{*f.SpeciesID}
	}))))
	if len(ids) == 0 {
		return map[db.ID]enums.Protection{}, nil
	}
	found, err := db.All(ctx, q, func(s db.Scanner) (protection, error) {
		var p protection
		return p, s.Scan(&p.id, &p.level)
	}, "SELECT id, protection FROM species WHERE id IN ("+db.Placeholders(len(ids))+")", db.Args(ids)...)
	if err != nil {
		return nil, err
	}
	return fn.Reduce(found, map[db.ID]enums.Protection{}, func(acc map[db.ID]enums.Protection, p protection) map[db.ID]enums.Protection {
		acc[p.id] = p.level
		return acc
	}), nil
}

func (m *Module) createFind(r *http.Request) (web.Response, error) {
	return ownWrite(m, r, finds, false, m.findValues(r), exactFind)
}

func (m *Module) getFind(r *http.Request) (web.Response, error) {
	return ownGet(m, r, finds, exactFind)
}

func (m *Module) putFind(r *http.Request) (web.Response, error) {
	return ownWrite(m, r, finds, true, m.findValues(r), exactFind)
}

func (m *Module) deleteFind(r *http.Request) (web.Response, error) {
	return ownDelete(m, r, finds)
}

func (m *Module) openFinds(r *http.Request) (web.Response, error) {
	p, err := paging.FromRequest(r, paging.MaxLimit)
	if err != nil {
		return nil, err
	}
	limit, offset := p.SQL()
	rows, err := db.All(r.Context(), m.deps.DB, finds.scan,
		"SELECT "+finds.columns+" FROM find WHERE review_state = ? AND deleted_at IS NULL "+
			"ORDER BY created_at LIMIT ? OFFSET ?", enums.ReviewStateOpen, limit, offset)
	if err != nil {
		return nil, err
	}
	return web.OK(pageOf(rows, p, exactFind)), nil
}

type reviewBody struct {
	Decision enums.ReviewDecision `json:"decision"`
}

// reviewFind sets the decision on a find of any person, deleted ones too.
func (m *Module) reviewFind(r *http.Request) (web.Response, error) {
	reviewer, err := m.userID(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	body, err := web.Decode[reviewBody](r)
	if err != nil {
		return nil, err
	}
	now := m.now()
	row, err := db.InTxValue(r.Context(), m.deps.DB, func(tx *sql.Tx) (findRow, error) {
		_, found, err := finds.get(r.Context(), tx, id)
		if err != nil {
			return findRow{}, err
		}
		if !found {
			return findRow{}, problem.NotFound()
		}
		if err := finds.set(r.Context(), tx, id, reviewColumns(enums.ReviewState(body.Decision), reviewer, now)); err != nil {
			return findRow{}, err
		}
		row, _, err := finds.get(r.Context(), tx, id)
		return row, err
	})
	if err != nil {
		return nil, err
	}
	return web.OK(exactFind(row)), nil
}

func reviewColumns(state enums.ReviewState, reviewer db.ID, now db.Time) []column {
	return []column{
		{"review_state", state}, {"reviewed_by_id", reviewer},
		{"reviewed_at", now}, {"updated_at", now},
	}
}

func (m *Module) acceptAll(r *http.Request) (web.Response, error) {
	reviewer, err := m.userID(r)
	if err != nil {
		return nil, err
	}
	cols := reviewColumns(enums.ReviewStateAccepted, reviewer, m.now())
	err = db.InTx(r.Context(), m.deps.DB, func(tx *sql.Tx) error {
		_, err := db.Exec(r.Context(), tx,
			"UPDATE find SET review_state = ?, reviewed_by_id = ?, reviewed_at = ?, updated_at = ? "+
				"WHERE review_state = ? AND deleted_at IS NULL",
			cols[0].value, cols[1].value, cols[2].value, cols[3].value, enums.ReviewStateOpen)
		return err
	})
	if err != nil {
		return nil, err
	}
	return web.Empty(http.StatusNoContent), nil
}

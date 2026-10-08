package objects

import (
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
)

type markerRow struct {
	owned
	Name       string
	Lat, Lon   float64
	Colour     enums.MarkerColour
	Visibility enums.Visibility
	GroupID    *db.ID
	Note       *string
}

var markers = kind[markerRow]{
	table:   "marker",
	columns: "id, owner_id, name, lat, lon, colour, visibility, group_id, note, created_at, updated_at, deleted_at",
	scan: func(s db.Scanner) (markerRow, error) {
		var m markerRow
		err := s.Scan(&m.ID, &m.OwnerID, &m.Name, &m.Lat, &m.Lon, &m.Colour, &m.Visibility, &m.GroupID,
			&m.Note, &m.CreatedAt, &m.UpdatedAt, &m.DeletedAt)
		return m, err
	},
	meta: func(m markerRow) owned { return m.owned },
}

type markerOut struct {
	ID         db.ID              `json:"id"`
	OwnerID    db.ID              `json:"ownerId"`
	Name       string             `json:"name"`
	Lat        float64            `json:"lat"`
	Lon        float64            `json:"lon"`
	Colour     enums.MarkerColour `json:"colour"`
	Visibility enums.Visibility   `json:"visibility"`
	GroupID    *db.ID             `json:"groupId"`
	Note       *string            `json:"note"`
	CreatedAt  db.Time            `json:"createdAt"`
	UpdatedAt  db.Time            `json:"updatedAt"`
	Deleted    bool               `json:"deleted"`
}

func markerOf(m markerRow) markerOut {
	return markerOut{
		ID: m.ID, OwnerID: m.OwnerID, Name: m.Name, Lat: m.Lat, Lon: m.Lon, Colour: m.Colour,
		Visibility: m.Visibility, GroupID: m.GroupID, Note: m.Note,
		CreatedAt: m.CreatedAt, UpdatedAt: m.UpdatedAt, Deleted: m.DeletedAt != nil,
	}
}

type markerWrite struct {
	Name       string              `json:"name"`
	Lat        float64             `json:"lat"`
	Lon        float64             `json:"lon"`
	Colour     *enums.MarkerColour `json:"colour"`
	Visibility *enums.Visibility   `json:"visibility"`
	GroupID    *db.ID              `json:"groupId"`
	Note       *string             `json:"note"`
}

func (m *Module) markerValues(r *http.Request) func(db.ID) ([]column, error) {
	return func(user db.ID) ([]column, error) {
		body, err := web.Decode[markerWrite](r)
		if err != nil {
			return nil, err
		}
		visibility := visibilityOr(body.Visibility)
		group, err := m.groupOf(r.Context(), user, visibility, body.GroupID)
		if err != nil {
			return nil, err
		}
		return []column{
			{"name", body.Name}, {"lat", body.Lat}, {"lon", body.Lon}, {"colour", colourOr(body.Colour)},
			{"visibility", visibility}, {"group_id", group}, {"note", body.Note},
		}, nil
	}
}

func (m *Module) listMarkers(r *http.Request) (web.Response, error) {
	return ownList(m, r, markers, markerOf)
}

func (m *Module) createMarker(r *http.Request) (web.Response, error) {
	return ownWrite(m, r, markers, false, m.markerValues(r), markerOf)
}

func (m *Module) getMarker(r *http.Request) (web.Response, error) {
	return ownGet(m, r, markers, markerOf)
}

func (m *Module) putMarker(r *http.Request) (web.Response, error) {
	return ownWrite(m, r, markers, true, m.markerValues(r), markerOf)
}

func (m *Module) deleteMarker(r *http.Request) (web.Response, error) {
	return ownDelete(m, r, markers)
}

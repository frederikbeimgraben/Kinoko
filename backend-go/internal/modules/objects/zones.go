package objects

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/pyjson"
)

type zoneRow struct {
	owned
	Name       string
	Polygon    string
	AreaHa     float64
	Colour     enums.MarkerColour
	Visibility enums.Visibility
	GroupID    *db.ID
	Note       *string
}

var zones = kind[zoneRow]{
	table: "zone",
	columns: "id, owner_id, name, polygon, area_ha, colour, visibility, group_id, note, " +
		"created_at, updated_at, deleted_at",
	scan: func(s db.Scanner) (zoneRow, error) {
		var z zoneRow
		err := s.Scan(&z.ID, &z.OwnerID, &z.Name, &z.Polygon, &z.AreaHa, &z.Colour, &z.Visibility,
			&z.GroupID, &z.Note, &z.CreatedAt, &z.UpdatedAt, &z.DeletedAt)
		return z, err
	},
	meta: func(z zoneRow) owned { return z.owned },
}

// polygon is a GeoJSON polygon.
type polygon struct {
	Type        string        `json:"type"`
	Coordinates [][][]float64 `json:"coordinates"`
}

// outerRing gives the first ring as points. A position without two numbers is skipped.
func (p polygon) outerRing() geo.Ring {
	if len(p.Coordinates) == 0 {
		return geo.Ring{}
	}
	return fn.FlatMap(p.Coordinates[0], func(pos []float64) []geo.Point {
		if len(pos) < 2 {
			return nil
		}
		return []geo.Point{{Lon: pos[0], Lat: pos[1]}}
	})
}

// stored writes the polygon as pydantic model_dump_json does.
func (p polygon) stored() string {
	return `{"type":"Polygon","coordinates":` + string(pyjson.MarshalCompact(p.Coordinates, false)) + "}"
}

func readPolygon(text string) polygon {
	var p polygon
	if err := json.Unmarshal([]byte(text), &p); err != nil || p.Coordinates == nil {
		return polygon{Type: "Polygon", Coordinates: [][][]float64{}}
	}
	p.Type = "Polygon"
	return p
}

type zoneOut struct {
	ID         db.ID              `json:"id"`
	OwnerID    db.ID              `json:"ownerId"`
	Name       string             `json:"name"`
	Polygon    polygon            `json:"polygon"`
	AreaHa     float64            `json:"areaHa"`
	Colour     enums.MarkerColour `json:"colour"`
	Visibility enums.Visibility   `json:"visibility"`
	GroupID    *db.ID             `json:"groupId"`
	Note       *string            `json:"note"`
	CreatedAt  db.Time            `json:"createdAt"`
	UpdatedAt  db.Time            `json:"updatedAt"`
	Deleted    bool               `json:"deleted"`
}

func zoneOf(z zoneRow) zoneOut {
	return zoneOut{
		ID: z.ID, OwnerID: z.OwnerID, Name: z.Name, Polygon: readPolygon(z.Polygon), AreaHa: z.AreaHa,
		Colour: z.Colour, Visibility: z.Visibility, GroupID: z.GroupID, Note: z.Note,
		CreatedAt: z.CreatedAt, UpdatedAt: z.UpdatedAt, Deleted: z.DeletedAt != nil,
	}
}

type zoneWrite struct {
	Name    string `json:"name"`
	Polygon struct {
		Coordinates [][][]laxFloat `json:"coordinates"`
	} `json:"polygon"`
	Colour     *enums.MarkerColour `json:"colour"`
	Visibility *enums.Visibility   `json:"visibility"`
	GroupID    *db.ID              `json:"groupId"`
	Note       *string             `json:"note"`
}

func (w zoneWrite) polygon() polygon {
	return polygon{Type: "Polygon", Coordinates: fn.Map(w.Polygon.Coordinates, func(r [][]laxFloat) [][]float64 {
		return fn.Map(r, func(pos []laxFloat) []float64 {
			return fn.Map(pos, func(f laxFloat) float64 { return float64(f) })
		})
	})}
}

func (m *Module) zoneValues(r *http.Request) func(db.ID) ([]column, error) {
	return func(user db.ID) ([]column, error) {
		body, err := web.Decode[zoneWrite](r)
		if err != nil {
			return nil, err
		}
		shape := body.polygon()
		visibility := visibilityOr(body.Visibility)
		group, err := m.groupOf(r.Context(), user, visibility, body.GroupID)
		if err != nil {
			return nil, err
		}
		return []column{
			{"name", body.Name}, {"polygon", shape.stored()}, {"area_ha", geo.AreaHa(shape.outerRing())},
			{"colour", colourOr(body.Colour)}, {"visibility", visibility}, {"group_id", group}, {"note", body.Note},
		}, nil
	}
}

func (m *Module) listZones(r *http.Request) (web.Response, error) {
	return ownList(m, r, zones, zoneOf)
}

func (m *Module) createZone(r *http.Request) (web.Response, error) {
	return ownWrite(m, r, zones, false, m.zoneValues(r), zoneOf)
}

func (m *Module) getZone(r *http.Request) (web.Response, error) {
	return ownGet(m, r, zones, zoneOf)
}

func (m *Module) putZone(r *http.Request) (web.Response, error) {
	return ownWrite(m, r, zones, true, m.zoneValues(r), zoneOf)
}

func (m *Module) deleteZone(r *http.Request) (web.Response, error) {
	return ownDelete(m, r, zones)
}

// zoneValue is the forecast value of a zone for a species and a week.
type zoneValue struct {
	SpeciesID db.ID   `json:"speciesId"`
	Year      int     `json:"year"`
	Week      int     `json:"week"`
	AreaMean  float64 `json:"areaMean"`
	Points    int     `json:"points"`
	OwnFinds  int     `json:"ownFinds"`
}

func (m *Module) zoneValue(r *http.Request) (web.Response, error) {
	user, err := m.userID(r)
	if err != nil {
		return nil, err
	}
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	species, err := idOf(r, "speciesId")
	if err == nil && species == nil {
		err = problem.InvalidField("speciesId", "missing")
	}
	if err != nil {
		return nil, err
	}
	year, err := intOf(r, "year")
	if err != nil {
		return nil, err
	}
	week, err := intOf(r, "week")
	if err != nil {
		return nil, err
	}
	zone, err := zones.own(r.Context(), m.deps.DB, user, id)
	if err != nil {
		return nil, err
	}
	ring := readPolygon(zone.Polygon).outerRing()
	mean, points, err := m.tileValue(r.Context(), ring, *species, year, week)
	if err != nil {
		return nil, err
	}
	places, err := db.All(r.Context(), m.deps.DB, func(s db.Scanner) (geo.Point, error) {
		var p geo.Point
		return p, s.Scan(&p.Lat, &p.Lon)
	}, "SELECT lat, lon FROM find WHERE owner_id = ? AND species_id = ? AND deleted_at IS NULL", user, *species)
	if err != nil {
		return nil, err
	}
	own := len(fn.Filter(places, func(p geo.Point) bool { return geo.Inside(p, ring) }))
	return web.OK(zoneValue{
		SpeciesID: *species, Year: year, Week: week, AreaMean: mean, Points: points, OwnFinds: own,
	}), nil
}

// tileValue reads the manifest of the species and averages its tiles
// under the ring. A missing species, manifest or week gives zero.
func (m *Module) tileValue(ctx context.Context, ring geo.Ring, species db.ID, year, week int) (float64, int, error) {
	slug, found, err := db.Maybe(ctx, m.deps.DB, func(s db.Scanner) (string, error) {
		var slug string
		return slug, s.Scan(&slug)
	}, "SELECT slug FROM species WHERE id = ?", species)
	if err != nil || !found {
		return 0, 0, err
	}
	folder := m.deps.Settings.Maps
	manifest, ok := readManifest(folder, slug)
	if !ok {
		return 0, 0, nil
	}
	entry, ok := findWeek(manifest, year, week)
	if !ok {
		return 0, 0, nil
	}
	return areaMean(folder, manifest, entry.Tiles, ring)
}

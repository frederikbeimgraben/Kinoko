package access

import (
	"context"
	"encoding/json"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// exportFind is an own find in the data export. Deleted is always false.
type exportFind struct {
	ID           db.ID    `json:"id"`
	OwnerID      db.ID    `json:"ownerId"`
	SpeciesID    *db.ID   `json:"speciesId"`
	Lat          float64  `json:"lat"`
	Lon          float64  `json:"lon"`
	FoundOn      db.Date  `json:"foundOn"`
	Count        *int64   `json:"count"`
	ForTraining  bool     `json:"forTraining"`
	ReviewState  string   `json:"reviewState"`
	ReviewedByID *db.ID   `json:"reviewedById"`
	ReviewedAt   *db.Time `json:"reviewedAt"`
	Visibility   string   `json:"visibility"`
	Note         *string  `json:"note"`
	CreatedAt    db.Time  `json:"createdAt"`
	UpdatedAt    db.Time  `json:"updatedAt"`
	Deleted      bool     `json:"deleted"`
}

type exportMarker struct {
	ID         db.ID   `json:"id"`
	OwnerID    db.ID   `json:"ownerId"`
	Name       string  `json:"name"`
	Lat        float64 `json:"lat"`
	Lon        float64 `json:"lon"`
	Colour     string  `json:"colour"`
	Visibility string  `json:"visibility"`
	Note       *string `json:"note"`
	CreatedAt  db.Time `json:"createdAt"`
	UpdatedAt  db.Time `json:"updatedAt"`
	Deleted    bool    `json:"deleted"`
}

type geoPolygon struct {
	Type        string        `json:"type"`
	Coordinates [][][]float64 `json:"coordinates"`
}

type exportZone struct {
	ID         db.ID      `json:"id"`
	OwnerID    db.ID      `json:"ownerId"`
	Name       string     `json:"name"`
	Polygon    geoPolygon `json:"polygon"`
	AreaHa     float64    `json:"areaHa"`
	Colour     string     `json:"colour"`
	Visibility string     `json:"visibility"`
	Note       *string    `json:"note"`
	CreatedAt  db.Time    `json:"createdAt"`
	UpdatedAt  db.Time    `json:"updatedAt"`
	Deleted    bool       `json:"deleted"`
}

type factor struct {
	Source    string   `json:"source"`
	Condition string   `json:"condition"`
	Low       *float64 `json:"low"`
	High      *float64 `json:"high"`
	Active    bool     `json:"active"`
}

type exportCombination struct {
	ID        db.ID    `json:"id"`
	OwnerID   db.ID    `json:"ownerId"`
	Name      string   `json:"name"`
	Rule      string   `json:"rule"`
	Factors   []factor `json:"factors"`
	CreatedAt db.Time  `json:"createdAt"`
	UpdatedAt db.Time  `json:"updatedAt"`
	Deleted   bool     `json:"deleted"`
}

type exportPhoto struct {
	ID           db.ID    `json:"id"`
	OwnerID      db.ID    `json:"ownerId"`
	SpeciesID    *db.ID   `json:"speciesId"`
	FindID       *db.ID   `json:"findId"`
	Width        int64    `json:"width"`
	Height       int64    `json:"height"`
	Photographer string   `json:"photographer"`
	Licence      string   `json:"licence"`
	Caption      *string  `json:"caption"`
	TakenOn      *db.Date `json:"takenOn"`
	Lat          *float64 `json:"lat"`
	Lon          *float64 `json:"lon"`
	Lead         bool     `json:"lead"`
	State        string   `json:"state"`
	RejectReason *string  `json:"rejectReason"`
	ReviewedByID *db.ID   `json:"reviewedById"`
	ReviewedAt   *db.Time `json:"reviewedAt"`
	CreatedAt    db.Time  `json:"createdAt"`
	UpdatedAt    db.Time  `json:"updatedAt"`
}

// accountExport is the own account with each own row.
type accountExport struct {
	Me           Me                  `json:"me"`
	Finds        []exportFind        `json:"finds"`
	Markers      []exportMarker      `json:"markers"`
	Zones        []exportZone        `json:"zones"`
	Combinations []exportCombination `json:"combinations"`
	Photos       []exportPhoto       `json:"photos"`
}

func scanExportFind(s db.Scanner) (exportFind, error) {
	var f exportFind
	return f, s.Scan(&f.ID, &f.OwnerID, &f.SpeciesID, &f.Lat, &f.Lon, &f.FoundOn, &f.Count,
		&f.ForTraining, &f.ReviewState, &f.ReviewedByID, &f.ReviewedAt, &f.Visibility, &f.Note,
		&f.CreatedAt, &f.UpdatedAt)
}

func scanExportMarker(s db.Scanner) (exportMarker, error) {
	var m exportMarker
	return m, s.Scan(&m.ID, &m.OwnerID, &m.Name, &m.Lat, &m.Lon, &m.Colour, &m.Visibility, &m.Note,
		&m.CreatedAt, &m.UpdatedAt)
}

func scanExportZone(s db.Scanner) (exportZone, error) {
	var z exportZone
	var polygon string
	if err := s.Scan(&z.ID, &z.OwnerID, &z.Name, &polygon, &z.AreaHa, &z.Colour, &z.Visibility, &z.Note,
		&z.CreatedAt, &z.UpdatedAt); err != nil {
		return z, err
	}
	parsed, err := parsePolygon(polygon)
	z.Polygon = parsed
	return z, err
}

func scanExportCombination(s db.Scanner) (exportCombination, error) {
	var c exportCombination
	var factors string
	if err := s.Scan(&c.ID, &c.OwnerID, &c.Name, &c.Rule, &factors, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return c, err
	}
	parsed, err := parseFactors(factors)
	c.Factors = parsed
	return c, err
}

func scanExportPhoto(owner db.ID) func(db.Scanner) (exportPhoto, error) {
	return func(s db.Scanner) (exportPhoto, error) {
		p := exportPhoto{OwnerID: owner}
		return p, s.Scan(&p.ID, &p.SpeciesID, &p.FindID, &p.Width, &p.Height, &p.Photographer,
			&p.Licence, &p.Caption, &p.TakenOn, &p.Lat, &p.Lon, &p.Lead, &p.State, &p.RejectReason,
			&p.ReviewedByID, &p.ReviewedAt, &p.CreatedAt, &p.UpdatedAt)
	}
}

// parsePolygon reads a stored GeoJSON polygon. The type is always "Polygon".
func parsePolygon(raw string) (geoPolygon, error) {
	var parsed struct {
		Coordinates [][][]float64 `json:"coordinates"`
	}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return geoPolygon{}, err
	}
	return geoPolygon{Type: "Polygon", Coordinates: parsed.Coordinates}, nil
}

type storedFactor struct {
	Source    string   `json:"source"`
	Condition string   `json:"condition"`
	Low       *float64 `json:"low"`
	High      *float64 `json:"high"`
	Active    *bool    `json:"active"`
}

// parseFactors reads stored factors. A factor without "active" is active.
func parseFactors(raw string) ([]factor, error) {
	var stored []storedFactor
	if err := json.Unmarshal([]byte(raw), &stored); err != nil {
		return nil, err
	}
	return fn.Map(stored, func(f storedFactor) factor {
		return factor{Source: f.Source, Condition: f.Condition, Low: f.Low, High: f.High, Active: fn.Deref(f.Active, true)}
	}), nil
}

func buildExport(ctx context.Context, q db.Querier, user auth.User) (accountExport, error) {
	out := accountExport{Me: meOf(user)}
	var err error
	if out.Finds, err = db.All(ctx, q, scanExportFind, `SELECT id, owner_id, species_id, lat, lon, found_on,
		count, for_training, review_state, reviewed_by_id, reviewed_at, visibility, note, created_at, updated_at
		FROM find WHERE owner_id = ? AND deleted_at IS NULL`, user.ID); err != nil {
		return out, err
	}
	if out.Markers, err = db.All(ctx, q, scanExportMarker, `SELECT id, owner_id, name, lat, lon, colour,
		visibility, note, created_at, updated_at
		FROM marker WHERE owner_id = ? AND deleted_at IS NULL`, user.ID); err != nil {
		return out, err
	}
	if out.Zones, err = db.All(ctx, q, scanExportZone, `SELECT id, owner_id, name, polygon, area_ha, colour,
		visibility, note, created_at, updated_at
		FROM zone WHERE owner_id = ? AND deleted_at IS NULL`, user.ID); err != nil {
		return out, err
	}
	if out.Combinations, err = db.All(ctx, q, scanExportCombination, `SELECT id, owner_id, name, rule, factors,
		created_at, updated_at
		FROM combination WHERE owner_id = ? AND deleted_at IS NULL`, user.ID); err != nil {
		return out, err
	}
	out.Photos, err = db.All(ctx, q, scanExportPhoto(user.ID), `SELECT id, species_id, find_id, width, height,
		photographer, licence, caption, taken_on, lat, lon, lead, state, reject_reason, reviewed_by_id,
		reviewed_at, created_at, updated_at
		FROM photo WHERE owner_id = ?`, user.ID)
	return out, err
}

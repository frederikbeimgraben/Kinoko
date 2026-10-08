package photos

import (
	"context"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/paging"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// ReviewRight is the permission that sees and changes each photo.
const ReviewRight = "image.review"

// Photo is a row of the table photo with the name of its owner.
type Photo struct {
	ID           db.ID
	OwnerID      *db.ID
	FindID       *db.ID
	SpeciesID    *db.ID
	Width        int
	Height       int
	Photographer string
	Licence      enums.Licence
	Source       *string
	TakenOn      *db.Date
	Caption      *string
	Lat          *float64
	Lon          *float64
	Lead         bool
	State        enums.PhotoState
	RejectReason *string
	ReviewedByID *db.ID
	ReviewedAt   *db.Time
	CreatedAt    db.Time
	UpdatedAt    db.Time
	OwnerName    *string
}

const selectPhoto = `SELECT p.id, p.owner_id, p.find_id, p.species_id, p.width, p.height,
	p.photographer, p.licence, p.source, p.taken_on, p.caption, p.lat, p.lon, p.lead,
	p.state, p.reject_reason, p.reviewed_by_id, p.reviewed_at, p.created_at, p.updated_at,
	u.name
	FROM photo p LEFT JOIN user u ON u.id = p.owner_id`

func scanPhoto(s db.Scanner) (Photo, error) {
	var p Photo
	err := s.Scan(&p.ID, &p.OwnerID, &p.FindID, &p.SpeciesID, &p.Width, &p.Height,
		&p.Photographer, &p.Licence, &p.Source, &p.TakenOn, &p.Caption, &p.Lat, &p.Lon, &p.Lead,
		&p.State, &p.RejectReason, &p.ReviewedByID, &p.ReviewedAt, &p.CreatedAt, &p.UpdatedAt,
		&p.OwnerName)
	return p, err
}

// Out is a photo in the form of the contract.
type Out struct {
	ID           db.ID            `json:"id"`
	OwnerID      *db.ID           `json:"ownerId"`
	SpeciesID    *db.ID           `json:"speciesId"`
	FindID       *db.ID           `json:"findId"`
	Width        int              `json:"width"`
	Height       int              `json:"height"`
	Photographer string           `json:"photographer"`
	OwnerName    string           `json:"ownerName"`
	Licence      enums.Licence    `json:"licence"`
	Caption      *string          `json:"caption"`
	Source       *string          `json:"source"`
	TakenOn      *db.Date         `json:"takenOn"`
	Lat          *float64         `json:"lat"`
	Lon          *float64         `json:"lon"`
	Lead         bool             `json:"lead"`
	State        enums.PhotoState `json:"state"`
	RejectReason *string          `json:"rejectReason"`
	ReviewedByID *db.ID           `json:"reviewedById"`
	ReviewedAt   *db.Time         `json:"reviewedAt"`
	CreatedAt    db.Time          `json:"createdAt"`
	UpdatedAt    db.Time          `json:"updatedAt"`
}

// ToOut gives the contract form. Without an account name the photographer names the photo.
func ToOut(p Photo) Out {
	ownerName := p.Photographer
	if p.OwnerName != nil && *p.OwnerName != "" {
		ownerName = *p.OwnerName
	}
	return Out{
		ID: p.ID, OwnerID: p.OwnerID, SpeciesID: p.SpeciesID, FindID: p.FindID,
		Width: p.Width, Height: p.Height, Photographer: p.Photographer, OwnerName: ownerName,
		Licence: p.Licence, Caption: p.Caption, Source: p.Source, TakenOn: p.TakenOn,
		Lat: p.Lat, Lon: p.Lon, Lead: p.Lead, State: p.State, RejectReason: p.RejectReason,
		ReviewedByID: p.ReviewedByID, ReviewedAt: p.ReviewedAt,
		CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}
}

// Public tells if each person can see the photo: approved and at a species.
func Public(p Photo) bool {
	return p.State == enums.PhotoStateApproved && p.SpeciesID != nil
}

// Visible tells if the viewer can see the photo.
func Visible(p Photo, viewer auth.Viewer) bool {
	return Public(p) || owns(viewer, p.OwnerID) || viewer.May(ReviewRight)
}

func owns(viewer auth.Viewer, owner *db.ID) bool {
	return owner != nil && viewer.Owns(*owner)
}

// mayChange tells if the viewer can change or delete a visible photo.
func mayChange(p Photo, viewer auth.Viewer) bool {
	return owns(viewer, p.OwnerID) || viewer.May(ReviewRight)
}

func photoByID(ctx context.Context, q db.Querier, id db.ID) (Photo, bool, error) {
	return db.Maybe(ctx, q, scanPhoto, selectPhoto+" WHERE p.id = ?", id)
}

// Filter selects photos of a list.
type Filter struct {
	State     *enums.PhotoState
	SpeciesID *db.ID
	FindID    *db.ID
	Mine      bool
}

type clause struct {
	sql  string
	args []any
}

// listClauses builds the conditions of a list, by what the viewer can see.
func listClauses(f Filter, viewer auth.Viewer) []clause {
	const public = "(p.state = 'approved' AND p.species_id IS NOT NULL)"
	scope := []clause{}
	switch {
	case f.Mine:
		scope = append(scope, clause{"p.owner_id = ?", []any{viewer.User.ID}})
	case viewer.May(ReviewRight):
	case viewer.User != nil:
		scope = append(scope, clause{"(" + public + " OR p.owner_id = ?)", []any{viewer.User.ID}})
	default:
		scope = append(scope, clause{public, nil})
	}
	optional := []clause{}
	if f.State != nil {
		optional = append(optional, clause{"p.state = ?", []any{string(*f.State)}})
	}
	if f.SpeciesID != nil {
		optional = append(optional, clause{"p.species_id = ?", []any{*f.SpeciesID}})
	}
	if f.FindID != nil {
		optional = append(optional, clause{"p.find_id = ?", []any{*f.FindID}})
	}
	return append(scope, optional...)
}

func listPhotos(ctx context.Context, q db.Querier, f Filter, viewer auth.Viewer, page paging.Paging) ([]Photo, error) {
	clauses := listClauses(f, viewer)
	where := ""
	if len(clauses) > 0 {
		where = " WHERE " + strings.Join(fn.Map(clauses, func(c clause) string { return c.sql }), " AND ")
	}
	args := fn.FlatMap(clauses, func(c clause) []any { return c.args })
	limit, offset := page.SQL()
	return db.All(ctx, q, scanPhoto,
		selectPhoto+where+" ORDER BY p.created_at DESC LIMIT ? OFFSET ?",
		append(args, limit, offset)...)
}

// OwnerPhotoIDs gives the keys of the photos of a person.
func OwnerPhotoIDs(ctx context.Context, q db.Querier, owner db.ID) ([]db.ID, error) {
	return db.Column[db.ID](ctx, q, "SELECT id FROM photo WHERE owner_id = ?", owner)
}

// RemoveOwnerFiles deletes the files of each photo of a person. Call it in
// the transaction that deletes the rows, before the delete.
func RemoveOwnerFiles(ctx context.Context, q db.Querier, photosDir string, owner db.ID) error {
	ids, err := OwnerPhotoIDs(ctx, q, owner)
	if err != nil {
		return err
	}
	return RemoveFiles(photosDir, ids)
}

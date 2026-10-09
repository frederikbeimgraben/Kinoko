package photos

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"maps"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// maxFieldBytes limits a text part, as the 1 MiB part limit of Starlette does.
const maxFieldBytes = 1 << 20

// formSlack is the space for the text parts and the multipart frame next to the file.
const formSlack = 1 << 20

// Upload is the file part of the form.
type Upload struct {
	Raw       []byte
	MediaType string
}

// form is the raw multipart form: the file and the last value of each text part.
type form struct {
	file   *Upload
	fields map[string]string
}

// Arrival is the checked form of an upload.
type Arrival struct {
	File         Upload
	Photographer string
	Licence      enums.Licence
	SpeciesID    *db.ID
	FindID       *db.ID
	Caption      *string
	Source       *string
	TakenOn      *db.Date
}

// readForm reads a multipart or URL-encoded body. The file part keeps at
// most limit+1 bytes, so Accept can tell 413 after the field checks.
func readForm(r *http.Request, limit int64) (form, error) {
	empty := form{fields: map[string]string{}}
	if r.Body == nil {
		return empty, nil
	}
	body := http.MaxBytesReader(nil, r.Body, limit+formSlack)
	mediaType, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	switch {
	case err != nil:
		return empty, nil //nolint:nilerr // A body without a known type gives no fields; the field checks then report the error.
	case mediaType == "application/x-www-form-urlencoded":
		raw, err := io.ReadAll(body)
		if err != nil {
			return empty, readError(err)
		}
		values, err := url.ParseQuery(string(raw))
		if err != nil {
			return empty, badBody()
		}
		return form{fields: lastValues(values)}, nil
	case mediaType != "multipart/form-data" || params["boundary"] == "":
		return empty, nil
	}
	return readParts(multipart.NewReader(body, params["boundary"]), limit)
}

func readParts(reader *multipart.Reader, limit int64) (form, error) {
	out := form{fields: map[string]string{}}
	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			return out, nil
		}
		if err != nil {
			return out, readError(err)
		}
		name := part.FormName()
		if isFile(part) {
			raw, err := io.ReadAll(io.LimitReader(part, limit+1))
			if err == nil {
				_, err = io.Copy(io.Discard, part)
			}
			if err != nil {
				return out, readError(err)
			}
			if name == "file" {
				out.file = &Upload{Raw: raw, MediaType: part.Header.Get("Content-Type")}
			}
			continue
		}
		raw, err := io.ReadAll(io.LimitReader(part, maxFieldBytes+1))
		if err != nil {
			return out, readError(err)
		}
		if len(raw) > maxFieldBytes {
			return out, badBody()
		}
		out.fields[name] = string(raw)
	}
}

// isFile tells if a part has a filename parameter, also an empty one, as Starlette decides.
func isFile(part *multipart.Part) bool {
	_, params, err := mime.ParseMediaType(part.Header.Get("Content-Disposition"))
	if err != nil {
		return false
	}
	_, ok := params["filename"]
	return ok
}

func lastValues(values url.Values) map[string]string {
	filled := fn.Filter(slices.Collect(maps.Keys(values)), func(key string) bool { return len(values[key]) > 0 })
	return fn.ToMap(filled, func(key string) (string, string) { return key, values[key][len(values[key])-1] })
}

func readError(err error) error {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return problem.TooLarge()
	}
	return badBody()
}

// badBody is the answer to a body that the service cannot parse: status
// 400 without a code of its own.
func badBody() error {
	return problem.New("internal", http.StatusBadRequest, "There was an error parsing the body")
}

// check validates the form in the order of its fields. An empty text value counts as a missing value.
func check(f form) (Arrival, error) {
	errs := []problem.FieldError{}
	fail := func(field, code string) { errs = append(errs, problem.FieldError{Field: field, Code: code}) }
	value := func(name string) (string, bool) {
		v, ok := f.fields[name]
		return v, ok && v != ""
	}
	out := Arrival{}
	if f.file == nil {
		fail("file", "missing")
	} else {
		out.File = *f.file
	}
	if v, ok := value("photographer"); !ok {
		fail("photographer", "missing")
	} else if utf8.RuneCountInString(v) > 120 {
		fail("photographer", "string_too_long")
	} else {
		out.Photographer = v
	}
	if v, ok := value("licence"); !ok {
		fail("licence", "missing")
	} else if !enums.Licence(v).Valid() {
		fail("licence", "enum")
	} else {
		out.Licence = enums.Licence(v)
	}
	optionalID := func(name string) *db.ID {
		v, ok := value(name)
		if !ok {
			return nil
		}
		id, err := db.ParseID(v)
		if err != nil {
			fail(name, "uuid_parsing")
			return nil
		}
		return &id
	}
	out.SpeciesID = optionalID("speciesId")
	out.FindID = optionalID("findId")
	optionalText := func(name string) *string {
		v, ok := value(name)
		if !ok {
			return nil
		}
		if utf8.RuneCountInString(v) > 200 {
			fail(name, "string_too_long")
			return nil
		}
		return &v
	}
	out.Caption = optionalText("caption")
	out.Source = optionalText("source")
	if v, ok := value("takenOn"); ok {
		day, err := parseDay(v)
		if err != nil {
			fail("takenOn", "date_from_datetime_parsing")
		} else {
			out.TakenOn = &day
		}
	}
	if len(errs) > 0 {
		return out, problem.Invalid(errs...)
	}
	return out, nil
}

// parseDay reads YYYY-MM-DD, or a time at midnight, as pydantic accepts it.
func parseDay(v string) (db.Date, error) {
	if len(v) == 10 {
		return db.ParseDate(v)
	}
	var t db.Time
	if err := t.Scan(strings.Replace(v, "Z", "+00:00", 1)); err != nil {
		return db.Date{}, err
	}
	if t.Hour() != 0 || t.Minute() != 0 || t.Second() != 0 || t.Nanosecond() != 0 {
		return db.Date{}, errors.New("time is not midnight")
	}
	return db.DateOf(t.Time), nil
}

type findRow struct {
	ownerID   db.ID
	speciesID *db.ID
	lat, lon  float64
	deleted   bool
}

func ownFind(ctx context.Context, q db.Querier, id db.ID, user auth.User) (findRow, error) {
	row, ok, err := db.Maybe(ctx, q, func(s db.Scanner) (findRow, error) {
		var f findRow
		err := s.Scan(&f.ownerID, &f.speciesID, &f.lat, &f.lon, &f.deleted)
		return f, err
	}, "SELECT owner_id, species_id, lat, lon, deleted_at IS NOT NULL FROM find WHERE id = ?", id)
	if err != nil {
		return row, err
	}
	if !ok || row.ownerID != user.ID || row.deleted {
		return row, problem.NotFound()
	}
	return row, nil
}

// locationOf gives the place of a photo at a find: on a coarse grid for a
// protected species, else no place.
func locationOf(ctx context.Context, q db.Querier, find findRow) (*float64, *float64, error) {
	if find.speciesID == nil {
		return nil, nil, nil
	}
	protection, ok, err := db.Maybe(ctx, q, func(s db.Scanner) (enums.Protection, error) {
		var p enums.Protection
		return p, s.Scan(&p)
	}, "SELECT protection FROM species WHERE id = ?", *find.speciesID)
	if err != nil || !ok || protection == enums.ProtectionNone {
		return nil, nil, err
	}
	place := geo.Coarse(geo.Point{Lon: find.lon, Lat: find.lat}, 1.0)
	return &place.Lat, &place.Lon, nil
}

func speciesExists(ctx context.Context, q db.Querier, id db.ID) error {
	_, ok, err := db.Maybe(ctx, q, func(s db.Scanner) (int, error) {
		var one int
		return one, s.Scan(&one)
	}, "SELECT 1 FROM species WHERE id = ?", id)
	if err == nil && !ok {
		return problem.NotFound()
	}
	return err
}

// create stores an upload: at an own find, at a species, or alone.
func (m *Module) create(ctx context.Context, user auth.User, a Arrival) (db.ID, error) {
	if a.FindID != nil {
		return m.attach(ctx, user, *a.FindID, a)
	}
	return m.submit(ctx, user, a)
}

func (m *Module) accept(a Arrival) (Rendered, error) {
	return Accept(a.File.Raw, a.File.MediaType, m.deps.Settings.MaxPhotoBytes)
}

func (m *Module) attach(ctx context.Context, user auth.User, findID db.ID, a Arrival) (db.ID, error) {
	find, err := ownFind(ctx, m.deps.DB, findID, user)
	if err != nil {
		return db.ID{}, err
	}
	rendered, err := m.accept(a)
	if err != nil {
		return db.ID{}, err
	}
	return db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (db.ID, error) {
		lat, lon, err := locationOf(ctx, tx, find)
		if err != nil {
			return db.ID{}, err
		}
		return m.insert(ctx, tx, user, a, rendered, &findID, nil, lat, lon, enums.PhotoStatePrivate)
	})
}

func (m *Module) submit(ctx context.Context, user auth.User, a Arrival) (db.ID, error) {
	rendered, err := m.accept(a)
	if err != nil {
		return db.ID{}, err
	}
	return db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (db.ID, error) {
		if a.SpeciesID == nil {
			return m.insert(ctx, tx, user, a, rendered, nil, nil, nil, nil, enums.PhotoStatePrivate)
		}
		if err := speciesExists(ctx, tx, *a.SpeciesID); err != nil {
			return db.ID{}, err
		}
		pending, found, err := db.Maybe(ctx, tx, scanPhoto, selectPhoto+` WHERE p.owner_id = ?
			AND p.species_id = ? AND p.find_id IS NULL AND p.state = 'rejected' LIMIT 1`,
			user.ID, *a.SpeciesID)
		if err != nil {
			return db.ID{}, err
		}
		if found {
			if err := Resubmittable(pending, user.ID); err != nil {
				return db.ID{}, err
			}
			return pending.ID, m.replace(ctx, tx, pending.ID, a, rendered)
		}
		return m.insert(ctx, tx, user, a, rendered, nil, a.SpeciesID, nil, nil, enums.PhotoStateSubmitted)
	})
}

func (m *Module) insert(ctx context.Context, tx *sql.Tx, user auth.User, a Arrival, rendered Rendered,
	findID, speciesID *db.ID, lat, lon *float64, state enums.PhotoState) (db.ID, error) {
	id := db.NewID()
	now := db.At(m.deps.Now())
	if _, err := tx.ExecContext(ctx, `INSERT INTO photo (id, owner_id, find_id, species_id, width,
		height, photographer, licence, source, taken_on, caption, lat, lon, lead, state,
		reject_reason, reviewed_by_id, reviewed_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, NULL, ?, ?)`,
		id, user.ID, findID, speciesID, rendered.Width, rendered.Height, a.Photographer,
		string(a.Licence), a.Source, a.TakenOn, a.Caption, lat, lon, string(state), now, now); err != nil {
		return db.ID{}, err
	}
	return id, WriteFiles(m.deps.Settings.Photos, id, rendered)
}

// replace puts a new image into a rejected photo and submits it again.
// The source stays.
func (m *Module) replace(ctx context.Context, tx *sql.Tx, id db.ID, a Arrival, rendered Rendered) error {
	if _, err := tx.ExecContext(ctx, `UPDATE photo SET width = ?, height = ?, photographer = ?,
		licence = ?, caption = ?, taken_on = ?, state = 'submitted', reject_reason = NULL,
		reviewed_by_id = NULL, reviewed_at = NULL, updated_at = ? WHERE id = ?`,
		rendered.Width, rendered.Height, a.Photographer, string(a.Licence), a.Caption, a.TakenOn,
		db.At(m.deps.Now()), id); err != nil {
		return err
	}
	return WriteFiles(m.deps.Settings.Photos, id, rendered)
}

// Resubmittable tells if the person can submit the photo again: only an own rejected photo.
func Resubmittable(p Photo, user db.ID) error {
	if p.OwnerID == nil || *p.OwnerID != user || p.State != enums.PhotoStateRejected {
		return problem.Conflict("", "")
	}
	return nil
}

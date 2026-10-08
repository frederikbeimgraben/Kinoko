package photos_test

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

const jpegType = "image/jpeg"

// newEnv builds the service. The base role loses its rights, so each test
// person holds only the rights that signIn gives, as in the Python tests.
func newEnv(t *testing.T, opts ...testkit.Option) *testkit.Env {
	t.Helper()
	env := testkit.New(t, opts...)
	exec(t, env, `DELETE FROM role_permission WHERE role_id IN (SELECT id FROM role WHERE slug = 'user')`)
	return env
}

func exec(t *testing.T, env *testkit.Env, query string, args ...any) {
	t.Helper()
	if _, err := env.DB.Exec(query, args...); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
}

func scalar[T any](t *testing.T, env *testkit.Env, query string, args ...any) T {
	t.Helper()
	var value T
	if err := env.DB.QueryRow(query, args...).Scan(&value); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
	return value
}

// makeUser adds a person row, as make_user of the Python tests.
func makeUser(t *testing.T, env *testkit.Env, sub string) testkit.Person {
	t.Helper()
	person := testkit.Someone(sub)
	exec(t, env, `INSERT INTO user (id, sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)`,
		db.NewID(), person.Sub, person.Email, person.Name, db.Now())
	return person
}

func userID(t *testing.T, env *testkit.Env, p testkit.Person) db.ID {
	t.Helper()
	return scalar[db.ID](t, env, "SELECT id FROM user WHERE sub = ?", p.Sub)
}

// signIn gives the person exactly the rights and returns the person for requests.
func signIn(t *testing.T, env *testkit.Env, p testkit.Person, rights ...string) *testkit.Person {
	t.Helper()
	slug := "test-" + p.Sub
	exec(t, env, `DELETE FROM role WHERE slug = ?`, slug)
	roleID := db.NewID()
	exec(t, env, `INSERT INTO role (id, slug, name, description, built_in, created_at, updated_at)
		VALUES (?, ?, ?, NULL, 0, ?, ?)`, roleID, slug, slug, db.Now(), db.Now())
	for _, right := range rights {
		exec(t, env, `INSERT OR IGNORE INTO permission ("key", area) VALUES (?, 'species')`, right)
		exec(t, env, `INSERT INTO role_permission (role_id, permission_key) VALUES (?, ?)`, roleID, right)
	}
	exec(t, env, `INSERT INTO user_role (user_id, role_id, granted_at) VALUES (?, ?, ?)`,
		userID(t, env, p), roleID, db.Now())
	return &p
}

func makeSpecies(t *testing.T, env *testkit.Env, slug string, protection enums.Protection) db.ID {
	t.Helper()
	id := db.NewID()
	// The seed catalogue holds real slugs, so each test species gets a unique suffix.
	unique := "test-" + slug + "-" + id.String()[:8]
	exec(t, env, `INSERT INTO species (id, slug, name, latin_name, group_key, edibility, marketable,
		forecast_enabled, protection, updated_at) VALUES (?, ?, ?, ?, 'bolete', 'edible', 0, 0, ?, ?)`,
		id, unique, unique, unique, string(protection), db.Now())
	return id
}

func makeFind(t *testing.T, env *testkit.Env, owner testkit.Person, species *db.ID, lat, lon float64) db.ID {
	t.Helper()
	id := db.NewID()
	exec(t, env, `INSERT INTO find (id, owner_id, species_id, lat, lon, found_on, for_training,
		review_state, visibility, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, '2026-09-01', 0, 'open', 'private', ?, ?)`,
		id, userID(t, env, owner), species, lat, lon, db.Now(), db.Now())
	return id
}

func imageBytes(t testing.TB, width, height int) []byte {
	t.Helper()
	made := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := range height {
		for x := range width {
			made.Set(x, y, color.RGBA{R: 120, G: 60, B: 10, A: 255})
		}
	}
	var buffer bytes.Buffer
	if err := jpeg.Encode(&buffer, made, nil); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

// multipartBody builds a form with text fields and a file part of a content type.
func multipartBody(t *testing.T, fields map[string]string, file []byte, fileType string) ([]byte, string) {
	t.Helper()
	var buffer bytes.Buffer
	writer := multipart.NewWriter(&buffer)
	for name, value := range fields {
		if err := writer.WriteField(name, value); err != nil {
			t.Fatal(err)
		}
	}
	if file != nil {
		header := textproto.MIMEHeader{}
		header.Set("Content-Disposition", `form-data; name="file"; filename="photo.jpg"`)
		header.Set("Content-Type", fileType)
		part, err := writer.CreatePart(header)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(file); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes(), writer.FormDataContentType()
}

func form(overrides map[string]string) map[string]string {
	base := map[string]string{"photographer": "Frederik", "licence": "own"}
	for key, value := range overrides {
		base[key] = value
	}
	return base
}

func postForm(t *testing.T, env *testkit.Env, as *testkit.Person, fields map[string]string, file []byte, fileType string) testkit.Response {
	t.Helper()
	body, contentType := multipartBody(t, fields, file, fileType)
	return env.Do(testkit.Request{Method: http.MethodPost, Path: "/photos", RawBody: body, Type: contentType, As: as})
}

func upload(t *testing.T, env *testkit.Env, as *testkit.Person, overrides map[string]string) testkit.Response {
	t.Helper()
	return postForm(t, env, as, form(overrides), imageBytes(t, 40, 40), jpegType)
}

// created uploads and returns the photo body. It fails the test without 201.
func created(t *testing.T, env *testkit.Env, as *testkit.Person, overrides map[string]string) map[string]any {
	t.Helper()
	return upload(t, env, as, overrides).Expect(t, http.StatusCreated).Map(t)
}

func idOf(body map[string]any) string { return fmt.Sprint(body["id"]) }

func ids(t *testing.T, r testkit.Response) map[string]bool {
	t.Helper()
	out := map[string]bool{}
	for _, item := range r.Expect(t, http.StatusOK).Map(t)["items"].([]any) {
		out[idOf(item.(map[string]any))] = true
	}
	return out
}

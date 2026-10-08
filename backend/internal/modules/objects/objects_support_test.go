package objects_test

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

// account is a person with a row in the table user, as make_user makes it.
type account struct {
	ID     db.ID
	Person *testkit.Person
}

func makeUser(t *testing.T, env *testkit.Env, sub string) account {
	t.Helper()
	person := testkit.Someone(sub)
	id := db.NewID()
	if _, err := env.DB.Exec("INSERT INTO user (id, sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)",
		id, sub, person.Email, person.Name, db.Now()); err != nil {
		t.Fatal(err)
	}
	return account{ID: id, Person: &person}
}

// makeReviewer makes a person in the admin group. The admin group has
// each permission of the table permission, find.review too.
func makeReviewer(t *testing.T, env *testkit.Env, sub string) account {
	t.Helper()
	if _, err := env.DB.Exec(`INSERT OR IGNORE INTO permission ("key", area) VALUES ('find.review', 'data')`); err != nil {
		t.Fatal(err)
	}
	made := makeUser(t, env, sub)
	made.Person.Groups = []string{testkit.AdminGroup}
	return made
}

func makeSpecies(t *testing.T, env *testkit.Env, slug string, protection enums.Protection) db.ID {
	t.Helper()
	id := db.NewID()
	if _, err := env.DB.Exec(`INSERT INTO species (id, slug, name, latin_name, group_key, edibility,
		marketable, forecast_enabled, protection, updated_at) VALUES (?, ?, ?, ?, 'bolete', 'edible', 0, 1, ?, ?)`,
		id, slug, slug, slug, protection, db.Now()); err != nil {
		t.Fatal(err)
	}
	return id
}

// makeGroup makes a group with its owner as member, as the access module does.
func makeGroup(t *testing.T, env *testkit.Env, owner db.ID) db.ID {
	t.Helper()
	id := db.NewID()
	if _, err := env.DB.Exec(`INSERT INTO "group" (id, name, owner_id, invite_code, created_at) VALUES (?, 'Familie', ?, ?, ?)`,
		id, owner, id.String()[:8], db.Now()); err != nil {
		t.Fatal(err)
	}
	join(t, env, id, owner)
	return id
}

func join(t *testing.T, env *testkit.Env, group, user db.ID) {
	t.Helper()
	if _, err := env.DB.Exec("INSERT INTO group_member (group_id, user_id, joined_at) VALUES (?, ?, ?)",
		group, user, db.Now()); err != nil {
		t.Fatal(err)
	}
}

type object = map[string]any

func with(base object, more object) object {
	out := object{}
	for k, v := range base {
		out[k] = v
	}
	for k, v := range more {
		out[k] = v
	}
	return out
}

func items(t *testing.T, r testkit.Response) []object {
	t.Helper()
	page := testkit.JSON[struct {
		Items      []object `json:"items"`
		NextCursor *string  `json:"nextCursor"`
	}](t, r)
	return page.Items
}

func ids(list []object) []string {
	out := []string{}
	for _, item := range list {
		out = append(out, item["id"].(string))
	}
	return out
}

func fieldErrors(t *testing.T, r testkit.Response) []map[string]string {
	t.Helper()
	return testkit.JSON[struct {
		Errors []map[string]string `json:"errors"`
	}](t, r).Errors
}

// writeJSON writes a JSON file under the folder.
func writeJSON(t *testing.T, folder, name string, body any) {
	t.Helper()
	if err := os.MkdirAll(folder, 0o755); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(folder, name), data, 0o644); err != nil {
		t.Fatal(err)
	}
}

// writeTile writes a grey value tile with one value in each pixel.
func writeTile(t *testing.T, folder string, zoom, x, y int, value uint8, size int) {
	t.Helper()
	dir := filepath.Join(folder, strconv.Itoa(zoom), strconv.Itoa(x))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	img := image.NewGray(image.Rect(0, 0, size, size))
	for i := range img.Pix {
		img.Pix[i] = value
	}
	file, err := os.Create(filepath.Join(dir, strconv.Itoa(y)+".png"))
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if err := png.Encode(file, img); err != nil {
		t.Fatal(err)
	}
}

func ctx() context.Context { return context.Background() }

// tick waits a little, so that the next write has a later time.
func tick() { time.Sleep(2 * time.Millisecond) }

// keysOf gives the top keys of a JSON object in their order, as quoted names.
func keysOf(t *testing.T, body []byte) string {
	t.Helper()
	decoder := json.NewDecoder(bytes.NewReader(body))
	if _, err := decoder.Token(); err != nil {
		t.Fatal(err)
	}
	keys := []string{}
	for decoder.More() {
		key, err := decoder.Token()
		if err != nil {
			t.Fatal(err)
		}
		keys = append(keys, strconv.Quote(key.(string)))
		var skip json.RawMessage
		if err := decoder.Decode(&skip); err != nil {
			t.Fatal(err)
		}
	}
	return strings.Join(keys, ",")
}

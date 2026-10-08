package texts_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"io/fs"
	"path/filepath"
	"testing"
	"testing/fstest"

	backend "github.com/frederikbeimgraben/kinoko/backend"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/texts"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

// editor is a person that gets text.edit through the admin group.
func editor() *testkit.Person { return testkit.Ptr(testkit.Admin()) }

// grantTextEdit makes sure that the table permission holds text.edit. The
// admin group gets each permission of that table.
func grantTextEdit(t *testing.T, env *testkit.Env) {
	t.Helper()
	if _, err := env.DB.Exec(`INSERT OR IGNORE INTO permission ("key", area) VALUES ('text.edit', 'interface')`); err != nil {
		t.Fatal(err)
	}
}

// emptySchema opens a new database with the schema and without rows.
func emptySchema(t *testing.T) *sql.DB {
	t.Helper()
	handle, err := db.Open(filepath.Join(t.TempDir(), "pilze.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { handle.Close() })
	if err := db.Migrate(context.Background(), handle); err != nil {
		t.Fatal(err)
	}
	return handle
}

// source gives a data folder that holds only the seed file.
func source(t *testing.T, data texts.Defaults) fs.FS {
	t.Helper()
	raw, err := json.Marshal(data)
	if err != nil {
		t.Fatal(err)
	}
	return fstest.MapFS{texts.SourceFile: {Data: raw}}
}

func embedded(t *testing.T) fs.FS {
	t.Helper()
	data, err := fs.Sub(backend.Data, "daten")
	if err != nil {
		t.Fatal(err)
	}
	return data
}

type pair struct{ key, locale string }

// wanted gives each key of the seed file, for each locale.
func wanted(t *testing.T) map[pair]struct{} {
	t.Helper()
	defaults, err := texts.ReadDefaults(embedded(t))
	if err != nil {
		t.Fatal(err)
	}
	out := map[pair]struct{}{}
	for locale, entries := range defaults {
		for key := range entries {
			out[pair{key, locale}] = struct{}{}
		}
	}
	return out
}

func storedPairs(t *testing.T, handle *sql.DB) map[pair]struct{} {
	t.Helper()
	rows, err := handle.Query(`SELECT "key", locale FROM text`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	out := map[pair]struct{}{}
	for rows.Next() {
		var p pair
		if err := rows.Scan(&p.key, &p.locale); err != nil {
			t.Fatal(err)
		}
		out[p] = struct{}{}
	}
	return out
}

// makeUser adds a person row and gives its key.
func makeUser(t *testing.T, handle *sql.DB, sub string) db.ID {
	t.Helper()
	id := db.NewID()
	if _, err := handle.Exec(`INSERT INTO user (id, sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)`,
		id, sub, sub+"@example.org", sub, db.Now()); err != nil {
		t.Fatal(err)
	}
	return id
}

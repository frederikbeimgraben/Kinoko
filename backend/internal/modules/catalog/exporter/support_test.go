package exporter

import (
	"context"
	"database/sql"
	"io/fs"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	backend "github.com/frederikbeimgraben/kinoko/backend"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

var fixedNow = func() time.Time { return time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC) }

func seedData(t testing.TB) fs.FS {
	t.Helper()
	data, err := fs.Sub(backend.Data, "daten")
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func openDB(t testing.TB) *sql.DB {
	t.Helper()
	handle, err := db.Open(filepath.Join(t.TempDir(), "pilze.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = handle.Close() })
	if err := db.Migrate(context.Background(), handle); err != nil {
		t.Fatal(err)
	}
	return handle
}

// firstDifference shows the first line where two texts differ.
func firstDifference(got, want string) string {
	a, b := strings.Split(got, "\n"), strings.Split(want, "\n")
	for i := 0; i < len(a) || i < len(b); i++ {
		var x, y string
		if i < len(a) {
			x = a[i]
		}
		if i < len(b) {
			y = b[i]
		}
		if x != y {
			return "line " + strconv.Itoa(i+1) + "\n got: " + x + "\nwant: " + y
		}
	}
	return "equal"
}

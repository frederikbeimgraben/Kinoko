package dwd

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

// TestSQLStore runs the store on the table of migrations/0003_data_sources.sql.
func TestSQLStore(t *testing.T) {
	ctx := context.Background()
	handle, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer handle.Close()
	if err := db.Migrate(ctx, handle); err != nil {
		t.Fatal(err)
	}
	s := SQLStore{DB: handle}
	rec := CacheRecord{Source: SourceHyras, Key: "dwd/hyras/precipitation/pr_hyras_1_2026_v6-0_de.nc",
		URL: "https://example/pr.nc", ETag: `"abc"`, LastModified: "Mon, 09 Mar 2026 06:00:00 GMT",
		SizeBytes: 1234, SHA256: "ff", FetchedAt: march, CheckedAt: march, State: StateOK}
	if err := s.Put(ctx, rec); err != nil {
		t.Fatal(err)
	}
	got, ok, err := s.Get(ctx, rec.Source, rec.Key)
	if err != nil || !ok || got != rec {
		t.Fatalf("got %+v %v %v", got, ok, err)
	}
	rec.State, rec.Error, rec.CheckedAt = StateFailed, "HTTP 500", march.Add(time.Hour)
	rec.ETag = ""
	if err := s.Put(ctx, rec); err != nil {
		t.Fatal(err)
	}
	other := CacheRecord{Source: SourceHyras, Key: "dwd/hyras/a.nc", URL: "u", State: StateOK}
	if err := s.Put(ctx, other); err != nil {
		t.Fatal(err)
	}
	list, err := s.List(ctx, SourceHyras)
	if err != nil || len(list) != 2 || list[0] != other || list[1] != rec {
		t.Fatalf("list %+v %v", list, err)
	}
	if err := s.Delete(ctx, rec.Source, rec.Key); err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := s.Get(ctx, rec.Source, rec.Key); ok {
		t.Error("row still there")
	}
}

package db

import (
	"context"
	"path/filepath"
	"slices"
	"testing"
)

func TestMigrateMapsOldObjectColours(t *testing.T) {
	ctx := context.Background()
	handle, err := Open(filepath.Join(t.TempDir(), "x.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = handle.Close() }()
	all, err := loadMigrations(migrationsFS())
	if err != nil {
		t.Fatal(err)
	}
	if err := ensureTable(ctx, handle); err != nil {
		t.Fatal(err)
	}
	for _, m := range all {
		if m.name == "marker_colours" {
			break
		}
		if err := apply(ctx, handle, m); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := handle.ExecContext(ctx, `PRAGMA foreign_keys = OFF;
		INSERT INTO marker (id, owner_id, name, lat, lon, colour, visibility, created_at, updated_at)
		VALUES ('a', 'u', 'A', 1, 1, 'brown', 'private', '2026-01-01', '2026-01-01'),
		       ('b', 'u', 'B', 1, 1, 'blue', 'private', '2026-01-01', '2026-01-01'),
		       ('c', 'u', 'C', 1, 1, 'gold', 'private', '2026-01-01', '2026-01-01'),
		       ('d', 'u', 'D', 1, 1, 'red', 'private', '2026-01-01', '2026-01-01')`); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, handle); err != nil {
		t.Fatal(err)
	}
	got, err := Column[string](ctx, handle, "SELECT colour FROM marker ORDER BY id")
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"orange", "violet", "yellow", "red"}; !slices.Equal(got, want) {
		t.Fatalf("colours %v, want %v", got, want)
	}
}

func TestMigrateFreshDatabase(t *testing.T) {
	ctx := context.Background()
	handle, err := Open(filepath.Join(t.TempDir(), "x.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = handle.Close() }()
	if err := Migrate(ctx, handle); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, handle); err != nil {
		t.Fatalf("second run: %v", err)
	}
	tables, err := Scalar[int](ctx, handle, "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = 'species'")
	if err != nil || tables != 1 {
		t.Fatalf("species table missing: %v", err)
	}
}

func TestMigrateAdoptsAlembicDatabase(t *testing.T) {
	ctx := context.Background()
	handle, err := Open(filepath.Join(t.TempDir(), "x.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = handle.Close() }()
	baseline, err := loadMigrations(migrationsFS())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := handle.ExecContext(ctx, baseline[0].sql); err != nil {
		t.Fatal(err)
	}
	if _, err := handle.ExecContext(ctx, "CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY); INSERT INTO alembic_version VALUES ('baseline_4')"); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, handle); err != nil {
		t.Fatal(err)
	}
	version, err := Scalar[int](ctx, handle, "SELECT max(version) FROM schema_migrations")
	if err != nil || version < 1 {
		t.Fatalf("version %d: %v", version, err)
	}
}

func TestTimeRoundTrip(t *testing.T) {
	var value Time
	if err := value.Scan("2026-10-08 02:29:44.946512"); err != nil {
		t.Fatal(err)
	}
	stored, _ := value.Value()
	if stored != "2026-10-08 02:29:44.946512" {
		t.Fatalf("stored %v", stored)
	}
	if value.ISO() != "2026-10-08T02:29:44.946512Z" {
		t.Fatalf("iso %s", value.ISO())
	}
}

func TestIDForm(t *testing.T) {
	var id ID
	if err := id.Scan("ae23c25ea7a34aaba0cb3796920fdf6d"); err != nil {
		t.Fatal(err)
	}
	if id.String() != "ae23c25e-a7a3-4aab-a0cb-3796920fdf6d" {
		t.Fatal(id.String())
	}
	stored, _ := id.Value()
	if stored != "ae23c25ea7a34aaba0cb3796920fdf6d" {
		t.Fatal(stored)
	}
}

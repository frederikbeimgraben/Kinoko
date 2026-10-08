package db

import (
	"context"
	"path/filepath"
	"testing"
)

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

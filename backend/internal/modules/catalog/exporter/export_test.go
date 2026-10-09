package exporter

import (
	"context"
	"database/sql"
	"io/fs"
	"os"
	"path/filepath"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/texts"
)

// seeded gives a database with the seed of daten/: catalogue, reactions and glossary.
func seeded(t *testing.T) *sql.DB {
	t.Helper()
	handle := openDB(t)
	ctx := context.Background()
	if err := importer.SeedIfEmpty(ctx, handle, seedData(t), fixedNow); err != nil {
		t.Fatal(err)
	}
	if _, err := texts.SeedGlossary(ctx, handle, seedData(t), db.At(fixedNow())); err != nil {
		t.Fatal(err)
	}
	return handle
}

func export(t *testing.T, handle *sql.DB) (string, Report) {
	t.Helper()
	out := t.TempDir()
	report, err := Export(context.Background(), handle, seedData(t), out)
	if err != nil {
		t.Fatal(err)
	}
	return out, report
}

func seedFiles(t *testing.T) []string {
	t.Helper()
	names, err := fs.Glob(seedData(t), "arten/*.toml")
	if err != nil {
		t.Fatal(err)
	}
	return append(names, importer.ReactionsFile, texts.GlossaryFile)
}

// The export of an unchanged import gives each seed file back, byte for byte.
func TestRoundTripGivesTheSeedBack(t *testing.T) {
	out, report := export(t, seeded(t))
	for _, name := range seedFiles(t) {
		want, err := fs.ReadFile(seedData(t), name)
		if err != nil {
			t.Fatal(err)
		}
		got, err := os.ReadFile(filepath.Join(out, name))
		if err != nil {
			t.Fatal(err)
		}
		if string(got) != string(want) {
			t.Errorf("%s:\n%s", name, firstDifference(string(got), string(want)))
		}
	}
	exported, err := filepath.Glob(filepath.Join(out, "arten", "*.toml"))
	if err != nil {
		t.Fatal(err)
	}
	if len(exported) != len(seedFiles(t))-2 || report.Species != len(exported) {
		t.Fatalf("exported %d profiles, report %d", len(exported), report.Species)
	}
	if len(report.Warnings) > 0 {
		t.Fatalf("warnings: %v", report.Warnings)
	}
}

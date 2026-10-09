package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestVersionOpensNoDatabase(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("PILZE_DB", "./var/pilze.sqlite")
	if err := run([]string{"version"}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat("var"); !os.IsNotExist(err) {
		t.Fatal("version made the folder var:", err)
	}
}

func TestExportCatalogWritesTheSeedFiles(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	t.Setenv("PILZE_DB", filepath.Join(dir, "pilze.sqlite"))
	if err := run([]string{"import-catalog"}); err != nil {
		t.Fatal(err)
	}
	if err := run([]string{"export-catalog", "--out", "seed"}); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"seed/reaktionen.json", "seed/glossar.json", "seed/arten"} {
		if _, err := os.Stat(name); err != nil {
			t.Fatal(err)
		}
	}
}

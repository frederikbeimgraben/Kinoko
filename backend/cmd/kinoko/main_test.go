package main

import (
	"os"
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

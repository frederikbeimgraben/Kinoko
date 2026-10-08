package runs

import (
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
)

func TestLogReadsTheTailOfTheLogFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "run.log")
	lines := []string{}
	for i := range 5 {
		lines = append(lines, "line "+strconv.Itoa(i))
	}
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := logTail(&path, 2); !slices.Equal(got, []string{"line 3", "line 4"}) {
		t.Fatal(got)
	}
}

func TestLogWithoutALogPathIsEmpty(t *testing.T) {
	if got := logTail(nil, logTailLines); got == nil || len(got) != 0 {
		t.Fatal(got)
	}
}

func TestLogWithAMissingFileIsEmpty(t *testing.T) {
	path := "/no/such/file.log"
	if got := logTail(&path, logTailLines); len(got) != 0 {
		t.Fatal(got)
	}
	dir := t.TempDir()
	if got := logTail(&dir, logTailLines); len(got) != 0 {
		t.Fatal(got)
	}
}

func TestSplitLinesAgreesWithPython(t *testing.T) {
	cases := map[string][]string{
		"":             {},
		"a":            {"a"},
		"a\n":          {"a"},
		"a\n\nb":       {"a", "", "b"},
		"a\r\nb\rc\n":  {"a", "b", "c"},
		"a\u2028b\x0c": {"a", "b"},
	}
	for in, want := range cases {
		if got := splitLines(in); !slices.Equal(got, want) {
			t.Errorf("%q: %q, expected %q", in, got, want)
		}
	}
}

func TestOnlyNameNeedsExactlyOneSpecies(t *testing.T) {
	name := "Steinpilz"
	other := "Fliegenpilz"
	if got := onlyName(tallyRow{count: 1, first: &name, last: &name}); got == nil || *got != name {
		t.Fatal(got)
	}
	if got := onlyName(tallyRow{count: 2, first: &other, last: &name}); got != nil {
		t.Fatal(*got)
	}
}

func TestStagesOfEachKind(t *testing.T) {
	cases := map[enums.RunKind][]string{
		enums.RunKindTraining: {"run_all.sh"},
		enums.RunKindRender:   {"render_de.sh"},
		enums.RunKindFull:     {"run_all.sh", "render_de.sh"},
	}
	for kind, want := range cases {
		if got := Stages(kind); !slices.Equal(got, want) {
			t.Errorf("%s: %v", kind, got)
		}
	}
}

func TestLogPathUsesTheRunID(t *testing.T) {
	id := db.MustID("7bd01aea-40b6-49a6-821b-82fa4a2c9589")
	if got := LogPath("/var/runs", id); got != "/var/runs/7bd01aea-40b6-49a6-821b-82fa4a2c9589.log" {
		t.Fatal(got)
	}
}

func TestRecordsAndBrierComeFromTheLastLine(t *testing.T) {
	out := "visits with weather: 12\nBrier score raw 0.30 calibrated 0.25\nvisits with weather:  40\n" +
		"Brier score  raw 0.2 calibrated 0.125\n"
	if got := RecordsIn(out); got != 40 {
		t.Fatal(got)
	}
	if got := BrierIn(out); got == nil || *got != 0.125 {
		t.Fatal(got)
	}
	if RecordsIn("nothing") != 0 || BrierIn("nothing") != nil {
		t.Fatal("values from no lines")
	}
}

func TestMeanBrier(t *testing.T) {
	if MeanBrier(nil) != nil {
		t.Fatal("mean of no scores")
	}
	if got := MeanBrier([]float64{0.25, 0.75}); got == nil || *got != 0.5 {
		t.Fatal(got)
	}
	if EndState(true) != enums.RunStateFailed || EndState(false) != enums.RunStateFinished {
		t.Fatal("end state")
	}
}

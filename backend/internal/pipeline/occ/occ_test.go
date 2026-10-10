package occ_test

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"math"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/internal/occtest"
)

func readJSON(t *testing.T, path string, v any) {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, v); err != nil {
		t.Fatal(err)
	}
}

// Golden: pandas to_datetime(format="ISO8601", errors="coerce", utc=True).
func TestParseEventDateMatchesPandas(t *testing.T) {
	var cases [][2]*string
	readJSON(t, "testdata/eventdates.json", &cases)
	for _, c := range cases {
		got, ok := occ.ParseEventDate(*c[0])
		switch {
		case c[1] == nil && ok:
			t.Errorf("%q: got %s, pandas gives NaT", *c[0], got.Format(time.DateOnly))
		case c[1] != nil && !ok:
			t.Errorf("%q: got NaT, pandas gives %s", *c[0], *c[1])
		case c[1] != nil && got.Format(time.DateOnly) != *c[1]:
			t.Errorf("%q: got %s, pandas gives %s", *c[0], got.Format(time.DateOnly), *c[1])
		}
	}
}

// Golden: BLAKE2s digests and app observers.
func TestBlake2sAndAppObserver(t *testing.T) {
	var g struct {
		ObserverHash [][2]string `json:"observer_hash"`
		Blake2s32    [][2]string `json:"blake2s_32"`
	}
	readJSON(t, "testdata/observers.json", &g)
	for _, c := range g.Blake2s32 {
		if got := hex.EncodeToString(occ.Blake2s([]byte(c[0]), 32)); got != c[1] {
			t.Errorf("blake2s(%q) = %s, want %s", c[0], got, c[1])
		}
	}
	for _, c := range g.ObserverHash {
		if got := occ.AppObserver(c[0]); got != c[1] {
			t.Errorf("occ.AppObserver(%q) = %s, want %s", c[0], got, c[1])
		}
	}
}

func goldenAppFinds(t *testing.T) []occ.AppFind {
	t.Helper()
	var doc struct {
		Items []struct {
			ID             string  `json:"id"`
			ScientificName string  `json:"scientificName"`
			Lat            float64 `json:"lat"`
			Lon            float64 `json:"lon"`
			FoundOn        string  `json:"foundOn"`
		} `json:"items"`
	}
	readJSON(t, "testdata/app_finds.json", &doc)
	out := make([]occ.AppFind, len(doc.Items))
	for i, it := range doc.Items {
		d, err := time.Parse(time.DateOnly, it.FoundOn)
		if err != nil {
			t.Fatal(err)
		}
		out[i] = occ.AppFind{ID: it.ID, ScientificName: it.ScientificName, Lat: it.Lat, Lon: it.Lon, FoundOn: d}
	}
	return out
}

// Golden: the occurrence table after the raw and app read, the class filter, the date, the error filter and the grid.
func TestBuildOccurrencesMatchesGolden(t *testing.T) {
	want, err := occtest.Rows("testdata/occurrences.json")
	if err != nil {
		t.Fatal(err)
	}
	got, st, err := occ.BuildOccurrences(occ.Sources{API: "testdata/raw"}, goldenAppFinds(t), occ.MaxUncertainty)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != len(want) {
		t.Fatalf("got %d records, want %d (stats %+v)", len(got), len(want), st)
	}
	for i, w := range want {
		wr, _ := w.Record()
		g := got[i]
		if g.GBIFID != wr.GBIFID || g.Species != wr.Species || g.Observer != wr.Observer || g.Basis != wr.Basis ||
			!g.Date.Equal(wr.Date) || g.ISOYear != wr.ISOYear || g.ISOWeek != wr.ISOWeek || g.DOY != wr.DOY ||
			g.Cell != wr.Cell || g.Lat != wr.Lat || g.Lon != wr.Lon || !sameFloat(g.Uncertainty, wr.Uncertainty) {
			t.Fatalf("row %d: got %+v, want %+v", i, g, wr)
		}
		if math.Abs(g.X-wr.X) > 1e-3 || math.Abs(g.Y-wr.Y) > 1e-3 {
			t.Fatalf("row %d: x, y = %v, %v, pyproj gives %v, %v", i, g.X, g.Y, wr.X, wr.Y)
		}
	}
	if st.KeptApp != 16 || st.Kept != len(want) {
		t.Errorf("stats %+v", st)
	}
}

func sameFloat(a, b float64) bool { return a == b || (math.IsNaN(a) && math.IsNaN(b)) }

// writeChunk writes slim lines into a gzip chunk file.
func writeChunk(t *testing.T, dir, name string, lines ...string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, name), gz(t, lines), 0o644); err != nil {
		t.Fatal(err)
	}
}

func line(id, species, date string) string {
	return `{"gbifID": "` + id + `", "class": "Agaricomycetes", "species": "` + species +
		`", "decimalLatitude": 48.5, "decimalLongitude": 9.0, "eventDate": "` + date + `", "day": 1, "recordedByHash": "abc"}`
}

// The archive gives the years before its cutoff year, the API cache the later years; a gbifID counts once.
func TestBuildMergesArchiveAndAPI(t *testing.T) {
	dir := t.TempDir()
	api, arc := filepath.Join(dir, "api"), filepath.Join(dir, "archive")
	writeChunk(t, arc, "fungi_de_2023.jsonl.gz", line("1", "A", "2023-09-01"), line("2", "A", "2023-09-01"))
	writeChunk(t, arc, "fungi_de_2024.jsonl.gz", line("3", "A", "2024-09-01"), line("4", "Archive", "2024-12-31"))
	writeChunk(t, arc, "fungi_de_2025.jsonl.gz", line("5", "A", "2025-03-01"))
	writeChunk(t, api, "fungi_de_2023.jsonl.gz", line("1", "Ignored", "2023-09-01"))
	writeChunk(t, api, "fungi_de_2025-03.jsonl.gz", line("4", "API", "2025-03-01"), line("6", "A", "2025-03-01"))
	writeChunk(t, api, "fungi_de_2026.jsonl.gz", line("7", "A", "2026-09-01"), line("7", "A", "2026-09-01"))
	got, st, err := occ.BuildOccurrences(occ.Sources{API: api, Archive: arc, ArchiveCutoff: 2025}, nil, occ.MaxUncertainty)
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, r := range got {
		ids = append(ids, r.GBIFID+":"+r.Species)
	}
	want := []string{"1:A", "2:A", "3:A", "4:API", "6:A", "7:A"}
	if !slices.Equal(ids, want) {
		t.Fatalf("records %v, want %v", ids, want)
	}
	if st.Duplicates != 2 {
		t.Errorf("duplicates %d, want 2", st.Duplicates)
	}
	if _, _, err := occ.BuildOccurrences(occ.Sources{API: filepath.Join(dir, "none")}, nil, occ.MaxUncertainty); !errors.Is(err, occ.ErrNoFiles) {
		t.Errorf("no files: %v", err)
	}
}

// ReadOccurrences reads the golden parquet; WriteOccurrences round-trips.
func TestOccurrencesParquet(t *testing.T) {
	want, err := occtest.Records("testdata/occurrences.json")
	if err != nil {
		t.Fatal(err)
	}
	fromGolden, err := occ.ReadOccurrences("testdata/occurrences.parquet")
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "occurrences.parquet")
	if err := occ.WriteOccurrences(path, want); err != nil {
		t.Fatal(err)
	}
	roundTrip, err := occ.ReadOccurrences(path)
	if err != nil {
		t.Fatal(err)
	}
	for name, got := range map[string][]occ.Record{"golden": fromGolden, "round trip": roundTrip} {
		if len(got) != len(want) {
			t.Fatalf("%s: %d rows, want %d", name, len(got), len(want))
		}
		for i := range want {
			g, w := got[i], want[i]
			if !sameFloat(g.Uncertainty, w.Uncertainty) {
				t.Fatalf("%s row %d: uncertainty %v, want %v", name, i, g.Uncertainty, w.Uncertainty)
			}
			g.Uncertainty, w.Uncertainty = 0, 0
			if g != w {
				t.Fatalf("%s row %d: got %+v, want %+v", name, i, g, w)
			}
		}
	}
}

package texts_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"io/fs"
	"testing"
	"testing/fstest"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/texts"
)

func glossaryData(t *testing.T, entries ...texts.GlossarySeedEntry) fs.FS {
	t.Helper()
	raw, err := json.Marshal(map[string]any{"entries": entries})
	if err != nil {
		t.Fatal(err)
	}
	return fstest.MapFS{texts.GlossaryFile: {Data: raw}}
}

var velum = texts.GlossarySeedEntry{Term: "Velum", TermEn: "Veil", Definition: "Hülle.", DefinitionEn: "Veil."}

func seedGlossary(t *testing.T, handle *sql.DB, data fs.FS) texts.SeedReport {
	t.Helper()
	report, err := texts.SeedGlossary(context.Background(), handle, data, db.Time{Time: time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)})
	if err != nil {
		t.Fatal(err)
	}
	return report
}

func glossaryRows(t *testing.T, handle *sql.DB) map[string][3]string {
	t.Helper()
	rows, err := handle.Query(`SELECT term, term_en, definition, definition_en FROM glossary_entry`)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = rows.Close() }()
	out := map[string][3]string{}
	for rows.Next() {
		var term, termEn, definition, definitionEn string
		if err := rows.Scan(&term, &termEn, &definition, &definitionEn); err != nil {
			t.Fatal(err)
		}
		out[term] = [3]string{termEn, definition, definitionEn}
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestGlossarySeedIsIdempotentAndFollowsTheSeed(t *testing.T) {
	handle := emptySchema(t)
	if r := seedGlossary(t, handle, glossaryData(t, velum)); r.Added != 1 {
		t.Fatalf("%+v", r)
	}
	if r := seedGlossary(t, handle, glossaryData(t, velum)); r.Touched() != 0 {
		t.Fatalf("second run %+v", r)
	}
	changed := velum
	changed.Definition = "Gesamthülle."
	if r := seedGlossary(t, handle, glossaryData(t, changed)); r.Updated != 1 {
		t.Fatalf("changed seed %+v", r)
	}
	if got := glossaryRows(t, handle)["Velum"]; got != [3]string{"Veil", "Gesamthülle.", "Veil."} {
		t.Fatal(got)
	}
}

func TestGlossarySeedKeepsAnEditAndADelete(t *testing.T) {
	handle := emptySchema(t)
	other := texts.GlossarySeedEntry{Term: "Ring", Definition: "Rest des Velums."}
	seedGlossary(t, handle, glossaryData(t, velum, other))
	if _, err := handle.Exec(`INSERT INTO user (id, sub, name, email, created_at) VALUES ('11111111111111111111111111111111', 'u1', 'u', 'u@x', '2026-01-01')`); err != nil {
		t.Fatal(err)
	}
	if _, err := handle.Exec(`UPDATE glossary_entry SET definition = 'Eigene Fassung.', updated_by_id = '11111111111111111111111111111111' WHERE term = 'Velum'`); err != nil {
		t.Fatal(err)
	}
	if _, err := handle.Exec(`DELETE FROM glossary_entry WHERE term = 'Ring'`); err != nil {
		t.Fatal(err)
	}
	changed := velum
	changed.Definition = "Neu."
	if r := seedGlossary(t, handle, glossaryData(t, changed, other)); r.Touched() != 0 {
		t.Fatalf("%+v", r)
	}
	got := glossaryRows(t, handle)
	if len(got) != 1 || got["Velum"][1] != "Eigene Fassung." {
		t.Fatal(got)
	}
}

func TestTheGlossarySeedFileHasBothLanguages(t *testing.T) {
	entries, err := texts.ReadGlossary(embedded(t))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) < 80 {
		t.Fatalf("%d entries", len(entries))
	}
	terms := map[string]bool{}
	for _, e := range entries {
		if e.Term == "" || e.TermEn == "" || e.Definition == "" || e.DefinitionEn == "" || terms[e.Term] {
			t.Errorf("entry %+v", e)
		}
		terms[e.Term] = true
	}
	for _, need := range []string{"Hymenium", "Mykorrhiza", "Velum", "Lamellen", "Röhren", "Leisten", "Stacheln",
		"Ring (Manschette)", "Volva (Scheide)", "Knolle", "Hutdeckschicht", "Sporenpulver", "Saprobiont", "Parasit"} {
		if !terms[need] {
			t.Errorf("missing %s", need)
		}
	}
}

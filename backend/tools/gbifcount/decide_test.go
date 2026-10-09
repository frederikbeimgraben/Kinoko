package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

func profile(latin string, karte *string) importer.StemProfile {
	return importer.StemProfile{Stem: "art", Profile: importer.Profile{Name: "Art", Lateinisch: latin, Karte: karte}}
}

func found(species, class string, count int) answer {
	return answer{Match: match{SpeciesKey: 1, Species: species, Class: class}, Count: count}
}

func TestDecide(t *testing.T) {
	chain := "reizker"
	cases := []struct {
		name    string
		p       importer.StemProfile
		a       answer
		enabled bool
		karte   string
		note    string
	}{
		{"above", profile("Imleria badia", nil), found("Imleria badia", "Agaricomycetes", 1000), true, "imleria_badia", ""},
		{"below", profile("Imleria badia", nil), found("Imleria badia", "Agaricomycetes", 999), false, "", "below the threshold"},
		{"synonym", profile("Lepista flaccida", nil), found("Paralepista flaccida", "Agaricomycetes", 5000), false, "", "GBIF species is"},
		{"class", profile("Aleuria aurantia", nil), found("Aleuria aurantia", "Pezizomycetes", 5000), false, "", "class Pezizomycetes"},
		{"no match", profile("Nomen nudum", nil), answer{Count: -1}, false, "", "no GBIF species match"},
		{"kept", profile("Lactarius deliciosus", &chain), found("Lactarius deliciosus", "Agaricomycetes", 10), true, "reizker", "the karte value stays"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := decide(c.p, c.a, 1000)
			if r.Enabled != c.enabled || r.Karte != c.karte || !strings.Contains(r.Note, c.note) {
				t.Fatalf("%+v", r)
			}
			if r.Added != (c.enabled && c.p.Profile.Karte == nil) {
				t.Fatalf("added = %v", r.Added)
			}
		})
	}
}

func TestWithKarteAddsOneLine(t *testing.T) {
	path := filepath.Join("..", "..", "daten", "arten", "butterpilz.toml")
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(body), "\nkarte = ") {
		body = []byte(strings.Replace(string(body), "karte = \"suillus_luteus\"\n", "", 1))
	}
	got, err := withKarte(body, path, "suillus_luteus")
	if err != nil {
		t.Fatal(err)
	}
	if len(strings.Split(string(got), "\n")) != len(strings.Split(string(body), "\n"))+1 ||
		!strings.Contains(string(got), "baeume = [\"kiefer\"]\nkarte = \"suillus_luteus\"\n") {
		t.Fatalf("got:\n%s", got)
	}
	if _, err := withKarte([]byte("name = 'x'\n"), "bad.toml", "x"); err == nil {
		t.Fatal("a file in another style must fail")
	}
}

func TestReportListsEachSpecies(t *testing.T) {
	rows := []row{
		{Name: "Maronenröhrling", Latin: "Imleria badia", Answer: found("Imleria badia", "Agaricomycetes", 3486), Karte: "imleria_badia", Enabled: true, Added: true},
		{Name: "A|B", Latin: "Nomen nudum", Answer: answer{Count: -1}, Note: "no GBIF species match"},
	}
	text := report(rows, 1000, time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC))
	for _, want := range []string{
		"The threshold is 1000 records.",
		"Query date: 2026-10-09. Species: 2. With forecast: 1. Of these, 0 have a chain in `sources.Chains`.",
		"| Maronenröhrling | *Imleria badia* | 1 | 3486 | yes (`imleria_badia`) |  |",
		"| A\\|B | *Nomen nudum* | - | - | no | no GBIF species match |",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("missing %q", want)
		}
	}
	if strings.Contains(text, "%!") {
		t.Fatal("a format verb has no value")
	}
}

package main

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/exporter"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
)

// row is one species of the table.
type row struct {
	Stem, Name, Latin string
	Answer            answer
	// Karte is the karte value of the file after the run, or "" without forecast.
	Karte   string
	Enabled bool
	// Added is true when the run sets karte in a file without it.
	Added bool
	Note  string
}

// decide gives the forecast state of one species. A species with karte keeps it.
// A new species needs the threshold, the class of the occurrence table and the GBIF name of the catalogue.
func decide(p importer.StemProfile, a answer, threshold int) row {
	r := row{Stem: p.Stem, Name: p.Profile.Name, Latin: p.Profile.Lateinisch, Answer: a}
	if p.Profile.Karte != nil {
		r.Karte, r.Enabled = *p.Profile.Karte, true
		if a.Count < threshold {
			r.Note = "below the threshold; the karte value stays"
		}
		return r
	}
	switch {
	case a.Match.SpeciesKey == 0:
		r.Note = "no GBIF species match"
	case a.Match.Class != occ.TargetClass:
		r.Note = fmt.Sprintf("class %s; the occurrence table keeps only %s", orDash(a.Match.Class), occ.TargetClass)
	case !strings.EqualFold(a.Match.Species, p.Profile.Lateinisch):
		r.Note = fmt.Sprintf("GBIF species is %s; the records do not carry the catalogue name", a.Match.Species)
	case a.Count < threshold:
		r.Note = "below the threshold"
	default:
		r.Karte, r.Enabled, r.Added = sources.ChainKey(p.Profile.Lateinisch), true, true
	}
	return r
}

func orDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

// applyKarte writes karte into each file that decide enabled. The file must give
// itself back through the exporter, so that the change adds one line only.
func applyKarte(data string, rows []row) error {
	for _, r := range rows {
		if !r.Added {
			continue
		}
		path := filepath.Join(data, "arten", r.Stem+".toml")
		body, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		updated, err := withKarte(body, path, r.Karte)
		if err != nil {
			return err
		}
		if err := os.WriteFile(path, updated, 0o644); err != nil {
			return err
		}
	}
	return nil
}

// withKarte gives the file with karte set. It refuses a file that the exporter does not give back unchanged.
func withKarte(body []byte, source, karte string) ([]byte, error) {
	f, err := exporter.ParseFile(string(body), source)
	if err != nil {
		return nil, err
	}
	if !bytes.Equal(exporter.Format(f), body) {
		return nil, fmt.Errorf("%s: the exporter does not give the file back unchanged", source)
	}
	f.Karte = &karte
	return exporter.Format(f), nil
}

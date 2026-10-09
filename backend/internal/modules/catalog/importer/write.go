package importer

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"maps"
	"slices"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// Catalog is the complete built catalogue, ready to write.
type Catalog struct {
	Taxa     []TaxonRow
	Terms    Terms
	Species  []SpeciesRow
	Children Children
}

// Build builds the catalogue from the profiles and the taxa. It writes nothing.
func Build(profiles []StemProfile, taxa []TaxonEntry, newID func() db.ID, report *Report) (Catalog, error) {
	taxonRows, genusIDs, err := LoadTaxonomy(taxa, newID)
	if err != nil {
		return Catalog{}, err
	}
	speciesIDs := map[string]db.ID{}
	identities := make([]db.ID, len(profiles))
	for i, p := range profiles {
		identities[i] = newID()
		speciesIDs[p.Stem] = identities[i]
	}
	colours := ColourVocabulary(profiles)
	terms, err := BuildTerms(profiles, newID)
	if err != nil {
		return Catalog{}, err
	}
	seen := map[[2]db.ID]bool{}
	out := Catalog{Taxa: taxonRows, Terms: terms}
	for i, p := range profiles {
		row, children, err := BuildSpecies(Context{
			Stem:       p.Stem,
			Profile:    p.Profile,
			SpeciesID:  identities[i],
			Slug:       Slugify(p.Profile.Lateinisch),
			GenusIDs:   genusIDs,
			Terms:      terms,
			Colours:    colours,
			SpeciesIDs: speciesIDs,
			Report:     report,
			SeenPairs:  seen,
		})
		if err != nil {
			return Catalog{}, err
		}
		out.Species = append(out.Species, row)
		out.Children = out.Children.Append(children)
		for key, n := range children.Counts() {
			report.Counts[key] += n
		}
	}
	return out, nil
}

type insert struct {
	query string
	rows  [][]any
}

// inserts gives the statements in an order that the foreign keys accept.
func inserts(c Catalog, now db.Time) []insert {
	ch := c.Children
	return []insert{
		{"INSERT INTO taxon (id, rank, slug, name, latin_name, description, parent_id) VALUES (?, ?, ?, ?, ?, NULL, ?)",
			fn.Map(c.Taxa, func(r TaxonRow) []any { return []any{r.ID, r.Rank, r.Slug, r.Name, r.LatinName, r.ParentID} })},
		{"INSERT INTO term (id, kind, group_key, slug, name, position) VALUES (?, ?, ?, ?, ?, ?)",
			fn.Map(c.Terms.Rows, func(r TermRow) []any { return []any{r.ID, r.Kind, r.GroupKey, r.Slug, r.Name, r.Position} })},
		{`INSERT INTO species (id, slug, name, latin_name, taxon_id, group_key, edibility, marketable, forecast_enabled,
			frequency, red_list, description, description_en, description_draft, edibility_note, protection,
			protection_note, period_start_month, period_end_month, period_peak_month, smell_text, taste_text,
			hymenium_type, gill_attachment, gill_spacing, gill_edge, cap_shape_young, cap_shape_old, ring_shape,
			updated_at, updated_by_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
			fn.Map(c.Species, func(r SpeciesRow) []any {
				return []any{r.ID, r.Slug, r.Name, r.LatinName, r.TaxonID, r.GroupKey, r.Edibility, r.Marketable,
					r.ForecastEnabled, r.Frequency, r.RedList, r.Description, r.DescriptionEn, r.DescriptionDraft,
					r.EdibilityNote, r.Protection, r.ProtectionNote,
					r.PeriodStartMonth, r.PeriodEndMonth, r.PeriodPeakMonth, r.SmellText, r.TasteText, r.HymeniumType,
					r.GillAttachment, r.GillSpacing, r.GillEdge, r.CapShapeYoung, r.CapShapeOld, r.RingShape, now}
			})},
		{"INSERT INTO species_name (species_id, position, name, kind) VALUES (?, ?, ?, ?)",
			fn.Map(ch.Names, func(r NameRow) []any { return []any{r.SpeciesID, r.Position, r.Name, r.Kind} })},
		{"INSERT INTO species_measurement (species_id, part, dimension, low, high, unit) VALUES (?, ?, ?, ?, ?, ?)",
			fn.Map(ch.Measurements, func(r MeasurementRow) []any {
				return []any{r.SpeciesID, r.Part, r.Dimension, r.Low, r.High, r.Unit}
			})},
		{"INSERT INTO species_colour_range (species_id, part, mode) VALUES (?, ?, ?)",
			fn.Map(ch.Ranges, func(r ColourRangeRow) []any { return []any{r.SpeciesID, r.Part, r.Mode} })},
		{"INSERT INTO species_colour_change (species_id, position, part, from_name, from_hex, to_name, to_hex, speed) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?)",
			fn.Map(ch.Changes, func(r ChangeRow) []any {
				return []any{r.SpeciesID, r.Position, r.Part, r.ToName, r.ToHex, r.Speed}
			})},
		{"INSERT INTO species_part_feature (species_id, part, feature, phase) VALUES (?, ?, ?, ?)",
			fn.Map(ch.PartFeatures, func(r PartFeatureRow) []any { return []any{r.SpeciesID, r.Part, r.Feature, r.Phase} })},
		{`INSERT INTO species_trait (species_id, "key", body) VALUES (?, ?, ?)`,
			fn.Map(ch.Traits, func(r TraitRow) []any { return []any{r.SpeciesID, r.Key, r.Body} })},
		{"INSERT INTO species_part_note (species_id, part, description, comment) VALUES (?, ?, ?, ?)",
			fn.Map(ch.PartNotes, func(r PartNoteRow) []any { return []any{r.SpeciesID, r.Part, r.Description, r.Comment} })},
		{"INSERT INTO species_source (species_id, position, scope, title, url, checked_on) VALUES (?, ?, ?, ?, ?, ?)",
			fn.Map(ch.Sources, func(r SourceRow) []any {
				return []any{r.SpeciesID, r.Position, r.Scope, r.Title, r.URL, r.CheckedOn}
			})},
		{"INSERT INTO species_season (species_id, season) VALUES (?, ?)",
			fn.Map(ch.Seasons, func(r SeasonRow) []any { return []any{r.SpeciesID, r.Season} })},
		{"INSERT INTO species_term (species_id, term_id, from_experience) VALUES (?, ?, ?)",
			fn.Map(ch.Terms, func(r SpeciesTermRow) []any { return []any{r.SpeciesID, r.TermID, r.FromExperience} })},
		{"INSERT INTO species_lookalike (species_a_id, species_b_id, difference_a, difference_b) VALUES (?, ?, ?, ?)",
			fn.Map(ch.Lookalikes, func(r LookalikeRow) []any {
				return []any{r.SpeciesAID, r.SpeciesBID, r.DifferenceA, r.DifferenceB}
			})},
		{"INSERT INTO species_colour (species_id, part, position, name, hex) VALUES (?, ?, ?, ?, ?)",
			fn.Map(ch.Colours, func(r ColourRow) []any { return []any{r.SpeciesID, r.Part, r.Position, r.Name, r.Hex} })},
		{"INSERT INTO species_colour_change_trigger (species_id, position, term_id) VALUES (?, ?, ?)",
			fn.Map(ch.Triggers, func(r TriggerRow) []any { return []any{r.SpeciesID, r.Position, r.TermID} })},
	}
}

// Write replaces species, terms and taxa with the catalogue. The delete
// cascades to photos and runs and clears the species of finds.
func Write(ctx context.Context, tx *sql.Tx, c Catalog, now db.Time) error {
	for _, table := range []string{"species", "term", "taxon"} {
		if _, err := tx.ExecContext(ctx, "DELETE FROM "+table); err != nil {
			return err
		}
	}
	for _, in := range inserts(c, now) {
		if err := execMany(ctx, tx, in.query, in.rows); err != nil {
			return err
		}
	}
	return nil
}

func execMany(ctx context.Context, tx *sql.Tx, query string, rows [][]any) error {
	if len(rows) == 0 {
		return nil
	}
	stmt, err := tx.PrepareContext(ctx, query)
	if err != nil {
		return err
	}
	defer func() { _ = stmt.Close() }()
	for _, args := range rows {
		if _, err := stmt.ExecContext(ctx, args...); err != nil {
			return fmt.Errorf("%s: %w", query, err)
		}
	}
	return nil
}

// ImportAll builds the catalogue from the data folder and writes it in one transaction.
// It records the digest of each species file.
func ImportAll(ctx context.Context, handle *sql.DB, profiles []StemProfile, data fs.FS, now func() time.Time) (*Report, error) {
	taxa, err := LoadTaxonEntries(data)
	if err != nil {
		return nil, err
	}
	report := NewReport()
	built, err := Build(profiles, taxa, db.NewID, report)
	if err != nil {
		return nil, err
	}
	err = db.InTx(ctx, handle, func(tx *sql.Tx) error {
		if err := Write(ctx, tx, built, db.At(now())); err != nil {
			return err
		}
		return saveSpeciesDigests(ctx, tx, data, profiles)
	})
	if err != nil {
		return nil, err
	}
	report.Counts["species"] = len(built.Species)
	report.Counts["taxa"] = len(built.Taxa)
	report.Counts["terms"] = len(built.Terms.Rows)
	return report, nil
}

var topLevelCounts = []string{"species", "taxa", "terms"}

// ReportLines gives the lines of the CLI report: main counts, other counts, then skips.
func ReportLines(r *Report) []string {
	var lines []string
	for _, key := range topLevelCounts {
		lines = append(lines, fmt.Sprintf("%s: %d", key, r.Counts[key]))
	}
	for _, key := range slices.Sorted(maps.Keys(r.Counts)) {
		if !slices.Contains(topLevelCounts, key) {
			lines = append(lines, fmt.Sprintf("%s: %d", key, r.Counts[key]))
		}
	}
	for _, key := range slices.Sorted(maps.Keys(r.Skipped)) {
		lines = append(lines, fmt.Sprintf("skipped %s: %d", key, r.Skipped[key]))
	}
	return lines
}

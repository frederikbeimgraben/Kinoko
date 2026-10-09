package catalog

import (
	"context"
	"database/sql"
	"regexp"
	"strings"
	"time"
	"unicode"

	"golang.org/x/text/unicode/norm"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
)

type colourIn struct {
	Name string `json:"name"`
	Hex  string `json:"hex"`
}

type termRefIn struct {
	ID db.ID `json:"id"`
}

type speciesWrite struct {
	Name             string                `json:"name"`
	ScientificName   string                `json:"scientificName"`
	TaxonID          *db.ID                `json:"taxonId"`
	Group            enums.Group           `json:"group"`
	Edibility        enums.Edibility       `json:"edibility"`
	Marketable       bool                  `json:"marketable"`
	Frequency        *enums.Frequency      `json:"frequency"`
	RedList          *enums.RedListStatus  `json:"redList"`
	Description      *string               `json:"description"`
	EdibilityNote    *string               `json:"edibilityNote"`
	Protection       enums.Protection      `json:"protection"`
	ProtectionNote   *string               `json:"protectionNote"`
	PeriodStartMonth *int                  `json:"periodStartMonth"`
	PeriodEndMonth   *int                  `json:"periodEndMonth"`
	PeriodPeakMonth  *int                  `json:"periodPeakMonth"`
	PeriodPeakWeek   *int                  `json:"periodPeakWeek"`
	SmellText        *string               `json:"smellText"`
	TasteText        *string               `json:"tasteText"`
	HymeniumType     *enums.HymeniumType   `json:"hymeniumType"`
	GillAttachment   *enums.GillAttachment `json:"gillAttachment"`
	GillSpacing      *enums.GillSpacing    `json:"gillSpacing"`
	GillEdge         *enums.GillEdge       `json:"gillEdge"`
	CapShapeYoung    *enums.CapShape       `json:"capShapeYoung"`
	CapShapeOld      *enums.CapShape       `json:"capShapeOld"`
	Names            []NameEntry           `json:"names"`
	Measurements     []MeasurementGroup    `json:"measurements"`
	PartNotes        []PartNote            `json:"partNotes"`
	Colours          []struct {
		Part    enums.BodyPart   `json:"part"`
		Mode    enums.ColourMode `json:"mode"`
		Colours []colourIn       `json:"colours"`
	} `json:"colours"`
	ColourChanges []struct {
		Part     enums.BodyPart `json:"part"`
		From     *colourIn      `json:"from"`
		To       colourIn       `json:"to"`
		Speed    *enums.Speed   `json:"speed"`
		Triggers []termRefIn    `json:"triggers"`
	} `json:"colourChanges"`
	CapFeatures  []CapFeatureEntry  `json:"capFeatures"`
	CapMargins   []CapMarginEntry   `json:"capMargins"`
	StemFeatures []StemFeatureEntry `json:"stemFeatures"`
	Traits       []Trait            `json:"traits"`
	Sources      []SourceEntry      `json:"sources"`
	Seasons      []enums.Season     `json:"seasons"`
	Terms        []struct {
		Term           termRefIn `json:"term"`
		FromExperience bool      `json:"fromExperience"`
	} `json:"terms"`
	Lookalikes []struct {
		Slug       string `json:"slug"`
		Difference string `json:"difference"`
	} `json:"lookalikes"`
}

var (
	umlauts = strings.NewReplacer("ä", "ae", "ö", "oe", "ü", "ue", "ß", "ss")
	nonWord = regexp.MustCompile(`[^a-z0-9]+`)
)

// SlugifyLatin makes the slug of a latin name: umlauts written out, other
// letters reduced to ASCII, each other run of signs a hyphen.
func SlugifyLatin(value string) string {
	lowered := umlauts.Replace(strings.ToLower(value))
	ascii := strings.Map(func(r rune) rune {
		if r > unicode.MaxASCII {
			return -1
		}
		return r
	}, norm.NFKD.String(lowered))
	return strings.Trim(nonWord.ReplaceAllString(ascii, "-"), "-")
}

func headValues(b speciesWrite) []any {
	peakMonth := b.PeriodPeakMonth
	if b.PeriodPeakWeek != nil {
		peakMonth = new(weekMonth(*b.PeriodPeakWeek))
	}
	return []any{b.Name, b.ScientificName, b.TaxonID, b.Group, b.Edibility, b.Marketable, b.Frequency,
		b.RedList, b.Description, b.EdibilityNote, b.Protection, b.ProtectionNote, b.PeriodStartMonth,
		b.PeriodEndMonth, peakMonth, b.SmellText, b.TasteText, b.HymeniumType, b.GillAttachment,
		b.GillSpacing, b.GillEdge, b.CapShapeYoung, b.CapShapeOld, b.PeriodPeakWeek}
}

// weekMonth gives the month of the Thursday of a calendar week; week 53 gives December.
// The peak month then agrees with the peak week, and the catalogue files keep a month.
func weekMonth(week int) int {
	return int(time.Date(2025, time.January, 2, 0, 0, 0, 0, time.UTC).AddDate(0, 0, (min(week, 52)-1)*7).Month())
}

const headCols = `name, latin_name, taxon_id, group_key, edibility, marketable, frequency, red_list,
	description, edibility_note, protection, protection_note, period_start_month, period_end_month,
	period_peak_month, smell_text, taste_text, hymenium_type, gill_attachment, gill_spacing, gill_edge,
	cap_shape_young, cap_shape_old, period_peak_week`

// uniqueConflict turns a broken UNIQUE constraint of name or latin name into 409.
func uniqueConflict(err error) error {
	if err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed") {
		return problem.Conflict("conflict", "")
	}
	return err
}

func insertSpecies(ctx context.Context, tx *sql.Tx, id db.ID, slug string, b speciesWrite, user db.ID, now db.Time) error {
	args := append([]any{id, slug}, headValues(b)...)
	args = append(args, false, now, user)
	_, err := tx.ExecContext(ctx, "INSERT INTO species (id, slug, "+headCols+
		", forecast_enabled, updated_at, updated_by_id) VALUES ("+db.Placeholders(len(args))+")", args...)
	return uniqueConflict(err)
}

func updateSpecies(ctx context.Context, tx *sql.Tx, id db.ID, b speciesWrite, user db.ID, now db.Time) error {
	sets := strings.Join(strings.FieldsFunc(headCols, func(r rune) bool { return r == ',' }), " = ?,") + " = ?"
	args := append(headValues(b), now, user, id)
	_, err := tx.ExecContext(ctx, "UPDATE species SET "+sets+", updated_at = ?, updated_by_id = ? WHERE id = ?", args...)
	return uniqueConflict(err)
}

// cleared are the child tables that a write replaces. The cascades remove
// species_colour and species_colour_change_trigger. Reactions stay.
var cleared = []string{
	"species_name", "species_measurement", "species_part_note", "species_colour_range",
	"species_colour_change", "species_part_feature", "species_trait", "species_source",
	"species_season", "species_term",
}

type statement struct {
	query string
	args  []any
}

// childStatements gives the inserts of the child rows, in order. Positions
// come from the list order.
func childStatements(id db.ID, b speciesWrite) []statement {
	out := []statement{}
	add := func(query string, args ...any) { out = append(out, statement{query, args}) }
	for i, n := range b.Names {
		add("INSERT INTO species_name (species_id, position, name, kind) VALUES (?, ?, ?, ?)", id, i, n.Name, n.Kind)
	}
	for _, g := range b.Measurements {
		for _, m := range g.Measurements {
			add(`INSERT INTO species_measurement (species_id, part, dimension, low, high, unit)
				VALUES (?, ?, ?, ?, ?, ?)`, id, g.Part, m.Dimension, m.Low, m.High, m.Unit)
		}
	}
	for _, n := range b.PartNotes {
		add("INSERT INTO species_part_note (species_id, part, description, comment) VALUES (?, ?, ?, ?)",
			id, n.Part, n.Description, n.Comment)
	}
	for _, t := range b.Traits {
		add(`INSERT INTO species_trait (species_id, "key", body) VALUES (?, ?, ?)`, id, t.Key, t.Text)
	}
	for i, s := range b.Sources {
		add(`INSERT INTO species_source (species_id, position, scope, title, url, checked_on)
			VALUES (?, ?, ?, ?, ?, ?)`, id, i, s.Scope, s.Title, s.URL, s.CheckedOn)
	}
	for _, s := range b.Seasons {
		add("INSERT INTO species_season (species_id, season) VALUES (?, ?)", id, s)
	}
	for _, t := range b.Terms {
		add("INSERT INTO species_term (species_id, term_id, from_experience) VALUES (?, ?, ?)",
			id, t.Term.ID, t.FromExperience)
	}
	feature := "INSERT INTO species_part_feature (species_id, part, feature, phase) VALUES (?, ?, ?, ?)"
	for _, c := range b.CapFeatures {
		add(feature, id, enums.BodyPartCap, c.Feature, c.Phase)
	}
	for _, c := range b.CapMargins {
		add(feature, id, enums.BodyPartCap, c.Margin, c.Phase)
	}
	for _, s := range b.StemFeatures {
		add(feature, id, enums.BodyPartStem, s.Feature, s.Phase)
	}
	for _, g := range b.Colours {
		add("INSERT INTO species_colour_range (species_id, part, mode) VALUES (?, ?, ?)", id, g.Part, g.Mode)
	}
	for _, g := range b.Colours {
		for i, c := range g.Colours {
			add("INSERT INTO species_colour (species_id, part, position, name, hex) VALUES (?, ?, ?, ?, ?)",
				id, g.Part, i, c.Name, c.Hex)
		}
	}
	for i, c := range b.ColourChanges {
		var fromName, fromHex *string
		if c.From != nil {
			fromName, fromHex = &c.From.Name, &c.From.Hex
		}
		add(`INSERT INTO species_colour_change (species_id, position, part, from_name, from_hex, to_name, to_hex, speed)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, id, i, c.Part, fromName, fromHex, c.To.Name, c.To.Hex, c.Speed)
	}
	for i, c := range b.ColourChanges {
		for _, t := range c.Triggers {
			add("INSERT INTO species_colour_change_trigger (species_id, position, term_id) VALUES (?, ?, ?)", id, i, t.ID)
		}
	}
	return out
}

// replaceChildren writes each child row of the species again.
func replaceChildren(ctx context.Context, tx *sql.Tx, id db.ID, b speciesWrite) error {
	for _, table := range cleared {
		if _, err := tx.ExecContext(ctx, "DELETE FROM "+table+" WHERE species_id = ?", id); err != nil {
			return err
		}
	}
	for _, s := range childStatements(id, b) {
		if _, err := tx.ExecContext(ctx, s.query, s.args...); err != nil {
			return err
		}
	}
	return syncLookalikes(ctx, tx, id, b)
}

type wantedPair struct {
	other db.ID
	text  string
}

// syncLookalikes stores the text that a species writes about another
// species in the slot of the other species. Each side changes only its text.
func syncLookalikes(ctx context.Context, tx *sql.Tx, id db.ID, b speciesWrite) error {
	wanted := []wantedPair{}
	for _, entry := range b.Lookalikes {
		other, found, err := db.Maybe(ctx, tx, func(s db.Scanner) (db.ID, error) {
			var x db.ID
			return x, s.Scan(&x)
		}, "SELECT id FROM species WHERE slug = ?", entry.Slug)
		if err != nil {
			return err
		}
		if !found || other == id {
			return problem.InvalidField("lookalikes", "unknown_slug")
		}
		wanted = upsertPair(wanted, wantedPair{other, entry.Difference})
	}
	existing, err := db.All(ctx, tx, func(s db.Scanner) (lookalikeRow, error) {
		var r lookalikeRow
		return r, s.Scan(&r.A, &r.B, &r.DifferenceA, &r.DifferenceB)
	}, `SELECT species_a_id, species_b_id, difference_a, difference_b FROM species_lookalike
		WHERE species_a_id = ? OR species_b_id = ?`, id, id)
	if err != nil {
		return err
	}
	for _, row := range existing {
		other := row.A
		if row.A == id {
			other = row.B
		}
		var text *string
		if i := pairIndex(wanted, other); i >= 0 {
			text = &wanted[i].text
			wanted = append(wanted[:i:i], wanted[i+1:]...)
		}
		a, b := row.DifferenceA, row.DifferenceB
		column := "difference_b"
		if row.A == other {
			column, a = "difference_a", text
		} else {
			b = text
		}
		if a == nil && b == nil {
			_, err = tx.ExecContext(ctx, "DELETE FROM species_lookalike WHERE species_a_id = ? AND species_b_id = ?", row.A, row.B)
		} else {
			_, err = tx.ExecContext(ctx, "UPDATE species_lookalike SET "+column+" = ? WHERE species_a_id = ? AND species_b_id = ?",
				text, row.A, row.B)
		}
		if err != nil {
			return err
		}
	}
	for _, w := range wanted {
		a, b := id, w.other
		if b.String() < a.String() {
			a, b = b, a
		}
		column := "difference_b"
		if a == w.other {
			column = "difference_a"
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO species_lookalike (species_a_id, species_b_id, "+column+
			") VALUES (?, ?, ?)", a, b, w.text); err != nil {
			return err
		}
	}
	return nil
}

func pairIndex(pairs []wantedPair, other db.ID) int {
	for i, p := range pairs {
		if p.other == other {
			return i
		}
	}
	return -1
}

// upsertPair keeps the first position of a slug and the last text.
func upsertPair(pairs []wantedPair, p wantedPair) []wantedPair {
	if i := pairIndex(pairs, p.other); i >= 0 {
		out := append([]wantedPair{}, pairs...)
		out[i].text = p.text
		return out
	}
	return append(pairs, p)
}

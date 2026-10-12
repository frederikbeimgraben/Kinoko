package catalog

import (
	"context"
	"database/sql"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
)

// reactionIn is a reaction of the write body. The reagent is the slug of a trigger term.
type reactionIn struct {
	Reagent struct {
		Slug string `json:"slug"`
	} `json:"reagent"`
	Reading         string           `json:"reading"`
	Part            *enums.BodyPart  `json:"part"`
	Location        *string          `json:"location"`
	Result          string           `json:"result"`
	Colour          *colourIn        `json:"colour"`
	Contested       bool             `json:"contested"`
	PartlyConfirmed bool             `json:"partlyConfirmed"`
	Sources         []ReactionSource `json:"sources"`
}

// replaceReactions writes the reactions of the species again. A source with
// a new label, address or year becomes a new row of reaction_source.
func replaceReactions(ctx context.Context, tx *sql.Tx, id db.ID, reactions []reactionIn) error {
	if _, err := tx.ExecContext(ctx, "DELETE FROM species_reaction WHERE species_id = ?", id); err != nil {
		return err
	}
	for position, r := range reactions {
		term, found, err := db.Maybe(ctx, tx, func(s db.Scanner) (db.ID, error) {
			var x db.ID
			return x, s.Scan(&x)
		}, "SELECT id FROM term WHERE kind = ? AND slug = ?", enums.TermKindTrigger, r.Reagent.Slug)
		if err != nil {
			return err
		}
		if !found {
			return problem.InvalidField("reactions", "unknown_reagent")
		}
		var colourName, colourHex *string
		if r.Colour != nil {
			colourName, colourHex = &r.Colour.Name, &r.Colour.Hex
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO species_reaction (species_id, position, term_id, reading, part,
			location, result, colour_name, colour_hex, contested, partly_confirmed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, position, term, r.Reading, r.Part, r.Location, r.Result, colourName, colourHex,
			r.Contested, r.PartlyConfirmed); err != nil {
			return err
		}
		if err := linkReactionSources(ctx, tx, id, position, r.Sources); err != nil {
			return err
		}
	}
	return nil
}

func linkReactionSources(ctx context.Context, tx *sql.Tx, id db.ID, position int, sources []ReactionSource) error {
	linked := map[db.ID]bool{}
	for _, source := range sources {
		source.Label = strings.TrimSpace(source.Label)
		if source.Label == "" {
			return problem.InvalidField("reactions", "source_label")
		}
		sourceID, err := reactionSourceID(ctx, tx, source)
		if err != nil {
			return err
		}
		if linked[sourceID] {
			continue
		}
		linked[sourceID] = true
		if _, err := tx.ExecContext(ctx, "INSERT INTO species_reaction_source (species_id, position, source_id) VALUES (?, ?, ?)",
			id, position, sourceID); err != nil {
			return err
		}
	}
	return nil
}

// reactionSourceID finds the source with the same label, address and year, or adds it.
func reactionSourceID(ctx context.Context, tx *sql.Tx, source ReactionSource) (db.ID, error) {
	held, found, err := db.Maybe(ctx, tx, func(s db.Scanner) (db.ID, error) {
		var x db.ID
		return x, s.Scan(&x)
	}, `SELECT id FROM reaction_source WHERE label = ? AND coalesce(url, '') = coalesce(?, '')
		AND coalesce(year, '') = coalesce(?, '') ORDER BY "key" LIMIT 1`, source.Label, source.URL, source.Year)
	if err != nil || found {
		return held, err
	}
	id := db.NewID()
	_, err = tx.ExecContext(ctx, `INSERT INTO reaction_source (id, "key", label, url, year) VALUES (?, ?, ?, ?, ?)`,
		id, sourceKey(source.Label, id), source.Label, source.URL, source.Year)
	return id, err
}

// sourceKey makes the key of a new source: the label as a slug and a part of the row key.
func sourceKey(label string, id db.ID) string {
	slug := SlugifyLatin(label)
	if len(slug) > 30 {
		slug = strings.TrimRight(slug[:30], "-")
	}
	suffix := strings.ReplaceAll(id.String(), "-", "")[:8]
	if slug == "" {
		return suffix
	}
	return slug + "-" + suffix
}

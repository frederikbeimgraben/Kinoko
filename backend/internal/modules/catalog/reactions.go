package catalog

import (
	"context"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// Reagent names the term of a reagent.
type Reagent struct {
	Slug string `json:"slug"`
	Name string `json:"name"`
}

// ReactionColour is the colour that a reagent gives. Nearest is the nearest standard colour.
type ReactionColour struct {
	Name    string `json:"name"`
	Hex     string `json:"hex"`
	Nearest string `json:"nearest"`
}

// ReactionSource is a source that tells a reaction.
type ReactionSource struct {
	Label string  `json:"label"`
	URL   *string `json:"url"`
	Year  *string `json:"year"`
}

// Reaction is the reaction of a species to a reagent.
type Reaction struct {
	Reagent         Reagent          `json:"reagent"`
	Reading         string           `json:"reading"`
	Part            *enums.BodyPart  `json:"part"`
	Location        *string          `json:"location"`
	Result          string           `json:"result"`
	Colour          *ReactionColour  `json:"colour"`
	Contested       bool             `json:"contested"`
	PartlyConfirmed bool             `json:"partlyConfirmed"`
	Sources         []ReactionSource `json:"sources"`
}

type reactionRow struct {
	Position   int
	Reaction   Reaction
	ColourName *string
	ColourHex  *string
}

type reactionSourceRow struct {
	Position int
	Source   ReactionSource
}

// loadReactions reads the reactions of one species, ordered by position.
func loadReactions(ctx context.Context, q db.Querier, species db.ID) ([]Reaction, error) {
	rows, err := db.All(ctx, q, func(s db.Scanner) (reactionRow, error) {
		var r reactionRow
		x := &r.Reaction
		err := s.Scan(&r.Position, &x.Reagent.Slug, &x.Reagent.Name, &x.Reading, &x.Part, &x.Location,
			&x.Result, &r.ColourName, &r.ColourHex, &x.Contested, &x.PartlyConfirmed)
		return r, err
	}, `SELECT r.position, t.slug, t.name, r.reading, r.part, r.location, r.result,
			r.colour_name, r.colour_hex, r.contested, r.partly_confirmed
		FROM species_reaction r JOIN term t ON t.id = r.term_id
		WHERE r.species_id = ? ORDER BY r.position`, species)
	if err != nil {
		return nil, err
	}
	sources, err := db.All(ctx, q, func(s db.Scanner) (reactionSourceRow, error) {
		var r reactionSourceRow
		return r, s.Scan(&r.Position, &r.Source.Label, &r.Source.URL, &r.Source.Year)
	}, `SELECT rs.position, s.label, s.url, s.year
		FROM species_reaction_source rs JOIN reaction_source s ON s.id = rs.source_id
		WHERE rs.species_id = ? ORDER BY rs.position, rs.rowid`, species)
	if err != nil {
		return nil, err
	}
	byPosition := fn.GroupBy(sources, func(r reactionSourceRow) int { return r.Position })
	return fn.Map(rows, func(r reactionRow) Reaction {
		out := r.Reaction
		if r.ColourName != nil && r.ColourHex != nil {
			out.Colour = &ReactionColour{Name: *r.ColourName, Hex: *r.ColourHex, Nearest: Nearest(*r.ColourHex).Hex}
		}
		out.Sources = fn.Map(byPosition[r.Position], func(s reactionSourceRow) ReactionSource { return s.Source })
		return out
	}), nil
}

// reactionCounts gives the count of reactions of each species that has one.
func reactionCounts(ctx context.Context, q db.Querier) (map[db.ID]int, error) {
	type count struct {
		species db.ID
		n       int
	}
	rows, err := db.All(ctx, q, func(s db.Scanner) (count, error) {
		var c count
		return c, s.Scan(&c.species, &c.n)
	}, "SELECT species_id, count(*) FROM species_reaction GROUP BY species_id")
	return fn.Reduce(rows, map[db.ID]int{}, func(acc map[db.ID]int, c count) map[db.ID]int {
		acc[c.species] = c.n
		return acc
	}), err
}

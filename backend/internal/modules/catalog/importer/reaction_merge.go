package importer

import (
	"regexp"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// PlaceSeparator joins the place slugs in the location of a reaction.
const PlaceSeparator = ","

// placeWords map a German place of daten/reaktionen.json to a place slug. An empty slug names no place.
var placeWords = map[string]string{
	"fleisch": string(enums.BodyPartFlesh), "stielbasis-fleisch": string(enums.BodyPartStemBase),
	"hut": string(enums.BodyPartCap), "huthaut": string(enums.BodyPartCap), "hutoberfläche": string(enums.BodyPartCap),
	"stiel": string(enums.BodyPartStem), "stielrinde": string(enums.BodyPartStem), "stielbasis": string(enums.BodyPartStemBase),
	"lamellen": string(enums.BodyPartGills), "röhren": string(enums.BodyPartTubes), "poren": string(enums.BodyPartPores),
	"sporen": string(enums.BodyPartSpore), "fruchtkörper": string(enums.BodyPartFruitbody),
	"alle teile des fruchtkörpers": string(enums.BodyPartFruitbody),
	"milch":                        "milk", "äste": "branches", "astspitzen": "branch_tips", "pilzsaft": "extract", "extrakt": "extract",
	"nicht angegeben": "",
}

var (
	placeNote  = regexp.MustCompile(`\([^)]*\)`)
	placeBreak = regexp.MustCompile(`\s*(?:,|/|;|\bund\b|\boder\b)\s*`)
)

// readPlace reads the German place of a reaction. One body part gives the part. More places give
// their slugs, joined by PlaceSeparator. A place with an unknown word stays German.
func readPlace(german *string) (*enums.BodyPart, *string) {
	if german == nil {
		return nil, nil
	}
	words := fn.Filter(placeBreak.Split(strings.ToLower(placeNote.ReplaceAllString(*german, "")), -1),
		func(word string) bool { return strings.TrimSpace(word) != "" })
	slugs := fn.Map(words, func(word string) string { return placeWords[strings.TrimSpace(word)] })
	known := fn.All(words, func(word string) bool { _, ok := placeWords[strings.TrimSpace(word)]; return ok })
	if !known || len(words) == 0 {
		return nil, german
	}
	places := fn.Unique(fn.Filter(slugs, func(slug string) bool { return slug != "" }))
	if len(places) == 0 {
		return nil, nil
	}
	if part := enums.BodyPart(places[0]); len(places) == 1 && part.Valid() {
		return &part, nil
	}
	return nil, fn.Ptr(strings.Join(places, PlaceSeparator))
}

// placeKey is the body part of a row, else its location.
func placeKey(row ReactionRow) string {
	if row.Part != nil {
		return string(*row.Part)
	}
	return fn.Deref(row.Location, "")
}

func samePlace(a, b ReactionRow) bool {
	return a.Reagent == b.Reagent && placeKey(a) == placeKey(b)
}

// mergeReadings gives one row for each reagent and place. A variable row sums up the other
// readings of its place. Readings with the same result join, also when one of them has no place.
// Readings with different results at one place become a variable row.
func mergeReadings(rows []ReactionRow) []ReactionRow {
	return fn.Reduce(foldSummaries(rows), []ReactionRow{}, func(kept []ReactionRow, row ReactionRow) []ReactionRow {
		index := slices.IndexFunc(kept, func(other ReactionRow) bool { return joins(other, row) })
		if index < 0 {
			return append(kept, row)
		}
		return slices.Replace(kept, index, index+1, join(kept[index], row))
	})
}

func joins(a, b ReactionRow) bool {
	if a.Reagent != b.Reagent {
		return false
	}
	if placeKey(a) == placeKey(b) {
		return true
	}
	return a.Result == b.Result && (placeKey(a) == "" || placeKey(b) == "")
}

// join keeps the row with a place. Two results at one place become a variable row.
func join(a, b ReactionRow) ReactionRow {
	out := a
	if placeKey(a) == "" {
		out.Part, out.Location = b.Part, b.Location
	}
	out.SourceKeys = fn.Unique(slices.Concat(a.SourceKeys, b.SourceKeys))
	out.Contested = a.Contested || b.Contested
	out.PartlyConfirmed = a.PartlyConfirmed && b.PartlyConfirmed
	if a.Result == b.Result {
		return out
	}
	out.Result = "variable"
	out.Reading = a.Reading + " vs. " + b.Reading
	if out.ColourName == nil {
		out.ColourName, out.ColourHex = b.ColourName, b.ColourHex
	}
	return out
}

// foldSummaries drops a reading that a variable row of the same reagent and place already sums up.
// The variable row takes the sources of the dropped rows.
func foldSummaries(rows []ReactionRow) []ReactionRow {
	summary := func(row ReactionRow) bool { return row.Result == "variable" }
	folded := func(row ReactionRow) bool {
		return !summary(row) && fn.Any(rows, func(other ReactionRow) bool { return summary(other) && samePlace(other, row) })
	}
	return fn.Map(fn.Filter(rows, func(row ReactionRow) bool { return !folded(row) }), func(row ReactionRow) ReactionRow {
		if !summary(row) {
			return row
		}
		parts := fn.Filter(rows, func(other ReactionRow) bool { return folded(other) && samePlace(other, row) })
		more := fn.FlatMap(parts, func(other ReactionRow) []string { return other.SourceKeys })
		row.SourceKeys = fn.Unique(append(slices.Clone(row.SourceKeys), more...))
		return row
	})
}

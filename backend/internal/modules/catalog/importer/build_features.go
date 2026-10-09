package importer

import (
	"cmp"
	"fmt"
	"net/url"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
)

// changeRows builds the reactions of a species: the mechanical change first, then each reagent.
func changeRows(ctx Context, _ SpeciesRow) (Children, error) {
	out := Children{}
	add := func(part enums.BodyPart, name, hex string, speed *string, trigger db.ID) {
		position := len(out.Changes)
		out.Changes = append(out.Changes, ChangeRow{
			SpeciesID: ctx.SpeciesID, Position: position, Part: part,
			ToName: name, ToHex: hex, Speed: speed,
		})
		out.Triggers = append(out.Triggers, TriggerRow{SpeciesID: ctx.SpeciesID, Position: position, TermID: trigger})
	}
	if change := mechanicalChange(ctx.Profile); change != nil {
		speed, err := optionalLookup(Speed, change.Dauer, "farben.verfaerbung.dauer", ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		trigger, err := ctx.Terms.IDFor(enums.TermKindTrigger, CutTriggerSlug)
		if err != nil {
			return Children{}, err
		}
		for _, colour := range change.Nach {
			add(enums.BodyPartFlesh, colour.Name, colour.Hex, speed, trigger)
		}
	}
	for _, entry := range ctx.Profile.Reagenzien {
		part, name, hex, ok := ReagentChange(entry.Reaktion, ctx.Colours)
		if !ok {
			ctx.Report.Skip("reagenz_ohne_zielfarbe")
			continue
		}
		slug, err := Lookup(ReagentSlug, entry.Reagenz, "reagenz", ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		trigger, err := ctx.Terms.IDFor(enums.TermKindTrigger, slug)
		if err != nil {
			return Children{}, err
		}
		add(part, name, hex, nil, trigger)
	}
	return out, nil
}

func mechanicalChange(p Profile) *ColourChange {
	for _, set := range p.Farben {
		if set.Key == changeKey && set.Change != nil {
			return set.Change
		}
	}
	return nil
}

func bothPhases(id db.ID, part enums.BodyPart, feature string) []PartFeatureRow {
	return []PartFeatureRow{
		{SpeciesID: id, Part: part, Feature: feature, Phase: enums.PhaseYoung},
		{SpeciesID: id, Part: part, Feature: feature, Phase: enums.PhaseOld},
	}
}

func featureRows(ctx Context, words []string, table map[string]string, field string, part enums.BodyPart) (Children, error) {
	var rows []PartFeatureRow
	for _, word := range words {
		value, err := Lookup(table, word, field, ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		rows = append(rows, bothPhases(ctx.SpeciesID, part, value)...)
	}
	return Children{PartFeatures: rows}, nil
}

func capFeatureRows(ctx Context, _ SpeciesRow) (Children, error) {
	return featureRows(ctx, ctx.Profile.Hutmerkmale, CapFeature, "hutmerkmale", enums.BodyPartCap)
}

func stemFeatureRows(ctx Context, _ SpeciesRow) (Children, error) {
	return featureRows(ctx, ctx.Profile.Stielmerkmale, StemFeature, "stielmerkmale", enums.BodyPartStem)
}

// capMarginRows applies the margin to both phases, or splits it by phase when it changes.
func capMarginRows(ctx Context, _ SpeciesRow) (Children, error) {
	margin := ctx.Profile.Hutrand
	if margin == nil {
		return Children{}, nil
	}
	if margin.Nach == nil {
		return featureRows(ctx, margin.Von, CapMargin, "hutrand.von", enums.BodyPartCap)
	}
	var rows []PartFeatureRow
	phase := func(words []string, field string, p enums.Phase) error {
		for _, word := range words {
			value, err := Lookup(CapMargin, word, field, ctx.Stem)
			if err != nil {
				return err
			}
			rows = append(rows, PartFeatureRow{SpeciesID: ctx.SpeciesID, Part: enums.BodyPartCap, Feature: value, Phase: p})
		}
		return nil
	}
	if err := phase(margin.Von, "hutrand.von", enums.PhaseYoung); err != nil {
		return Children{}, err
	}
	if err := phase(*margin.Nach, "hutrand.nach", enums.PhaseOld); err != nil {
		return Children{}, err
	}
	return Children{PartFeatures: rows}, nil
}

func traitRows(ctx Context, _ SpeciesRow) (Children, error) {
	var rows []TraitRow
	for _, trait := range ctx.Profile.Merkmale {
		key, err := Lookup(TraitKey, trait.Key, "merkmale", ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		rows = append(rows, TraitRow{SpeciesID: ctx.SpeciesID, Key: key, Body: trait.Text})
	}
	return Children{Traits: rows}, nil
}

func partNoteRows(ctx Context, _ SpeciesRow) (Children, error) {
	var rows []PartNoteRow
	for _, note := range ctx.Profile.Teilnotizen {
		part, err := Lookup(PartNoteKey, note.Key, "teilnotizen", ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		rows = append(rows, PartNoteRow{SpeciesID: ctx.SpeciesID, Part: enums.BodyPart(part),
			Description: note.Beschreibung, Comment: note.Kommentar})
	}
	return Children{PartNotes: rows}, nil
}

func hostnameTitle(raw string) string {
	host := raw
	if parsed, err := url.Parse(raw); err == nil && parsed.Hostname() != "" {
		host = strings.ToLower(parsed.Hostname())
	}
	return strings.TrimPrefix(host, "www.")
}

func sameURL(a, b string) bool {
	norm := func(raw string) string { return strings.TrimSuffix(strings.ToLower(strings.TrimSpace(raw)), "/") }
	return norm(a) == norm(b)
}

func sourceRows(ctx Context, _ SpeciesRow) (Children, error) {
	quelle := ctx.Profile.Quelle
	checked, err := db.ParseDate(quelle.GeprueftAm)
	if err != nil {
		return Children{}, fmt.Errorf("%s: quelle.geprueftAm: %w", ctx.Stem, err)
	}
	rows := []SourceRow{{
		SpeciesID: ctx.SpeciesID, Position: 0, Scope: enums.SourceScopeProfile,
		Title: cmp.Or(quelle.Titel, hostnameTitle(quelle.URL)), URL: quelle.URL, CheckedOn: checked,
	}}
	// A link to the address of the profile repeats the profile source.
	for _, link := range ctx.Profile.Links {
		if slices.ContainsFunc(rows, func(row SourceRow) bool { return sameURL(row.URL, link.URL) }) {
			continue
		}
		rows = append(rows, SourceRow{
			SpeciesID: ctx.SpeciesID, Position: len(rows), Scope: enums.SourceScopeFurther,
			Title: link.Titel, URL: link.URL, CheckedOn: checked,
		})
	}
	return Children{Sources: rows}, nil
}

func seasonRows(ctx Context, _ SpeciesRow) (Children, error) {
	var rows []SeasonRow
	for _, word := range ctx.Profile.Jahreszeiten {
		season, err := Lookup(Season, word, "jahreszeiten", ctx.Stem)
		if err != nil {
			return Children{}, err
		}
		rows = append(rows, SeasonRow{SpeciesID: ctx.SpeciesID, Season: season})
	}
	return Children{Seasons: rows}, nil
}

// speciesTermRows links smell, taste and trees. A term that occurs twice gives one row.
func speciesTermRows(ctx Context, _ SpeciesRow) (Children, error) {
	type wanted struct {
		kind       enums.TermKind
		slug       string
		experience bool
	}
	var want []wanted
	for _, tag := range senseTags(ctx.Profile.Geruch) {
		want = append(want, wanted{enums.TermKindSmell, Slugify(tag), false})
	}
	for _, tag := range senseTags(ctx.Profile.Geschmack) {
		want = append(want, wanted{enums.TermKindTaste, Slugify(tag), false})
	}
	trees := func(words []string, experience bool) error {
		for _, word := range words {
			tree, err := treeEntry(word)
			if err != nil {
				return err
			}
			want = append(want, wanted{enums.TermKindTree, tree.Slug, experience})
		}
		return nil
	}
	if err := trees(ctx.Profile.Baeume, false); err != nil {
		return Children{}, err
	}
	if err := trees(experienceTrees(ctx.Profile), true); err != nil {
		return Children{}, err
	}
	var rows []SpeciesTermRow
	seen := map[db.ID]bool{}
	for _, w := range want {
		id, err := ctx.Terms.IDFor(w.kind, w.slug)
		if err != nil {
			return Children{}, err
		}
		if seen[id] {
			continue
		}
		seen[id] = true
		rows = append(rows, SpeciesTermRow{SpeciesID: ctx.SpeciesID, TermID: id, FromExperience: w.experience})
	}
	return Children{Terms: rows}, nil
}

// lookalikeRows keeps each pair once. The text about the other species goes into its slot of the ordered pair.
func lookalikeRows(ctx Context, _ SpeciesRow) (Children, error) {
	var rows []LookalikeRow
	for _, entry := range ctx.Profile.Verwechslungen {
		other, ok := ctx.SpeciesIDs[entry.Slug]
		if !ok {
			ctx.Report.Skip("verwechslung_unbekannt")
			continue
		}
		own := ctx.SpeciesID
		ownFirst := idLess(own, other)
		pair := [2]db.ID{other, own}
		if ownFirst {
			pair = [2]db.ID{own, other}
		}
		if ctx.SeenPairs[pair] {
			ctx.Report.Skip("verwechslung_doppelt")
			continue
		}
		ctx.SeenPairs[pair] = true
		otherDiff := entry.Unterschied
		row := LookalikeRow{SpeciesAID: pair[0], SpeciesBID: pair[1], DifferenceA: &otherDiff, DifferenceB: entry.EigenerUnterschied}
		if ownFirst {
			row.DifferenceA, row.DifferenceB = entry.EigenerUnterschied, &otherDiff
		}
		rows = append(rows, row)
	}
	return Children{Lookalikes: rows}, nil
}

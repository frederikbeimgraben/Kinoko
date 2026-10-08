package importer

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
)

// ReactionsFile is the name of the reaction seed in the data folder.
const ReactionsFile = "reaktionen.json"

// ManualMatches give the profile stem of latin names that differ from the catalogue.
var ManualMatches = map[string]string{
	"lactifluus volemus":      "braetling",
	"neoboletus luridiformis": "flockenstieliger-hexenroehrling",
}

// ReactionEntry is one reaction of daten/reaktionen.json.
type ReactionEntry struct {
	Latin           string   `json:"latin"`
	GermanName      string   `json:"germanName"`
	Reagent         string   `json:"reagent"`
	Reading         string   `json:"reading"`
	Part            *string  `json:"part"`
	PartSlug        *string  `json:"partSlug"`
	Result          string   `json:"result"`
	Contested       bool     `json:"contested"`
	PartlyConfirmed bool     `json:"partlyConfirmed"`
	Sources         []string `json:"sources"`
}

// ReactionSource is one source of daten/reaktionen.json.
type ReactionSource struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	URL   *string `json:"url"`
	Year  *string `json:"year"`
}

// Reactions is the content of daten/reaktionen.json that the seed uses.
type Reactions struct {
	Reactions []ReactionEntry  `json:"reactions"`
	Sources   []ReactionSource `json:"sources"`
}

// LoadReactions reads daten/reaktionen.json. The bool is false when the file is absent.
func LoadReactions(data fs.FS) (Reactions, bool, error) {
	body, err := fs.ReadFile(data, ReactionsFile)
	if errors.Is(err, fs.ErrNotExist) {
		return Reactions{}, false, nil
	}
	if err != nil {
		return Reactions{}, false, err
	}
	var out Reactions
	if err := json.Unmarshal(body, &out); err != nil {
		return Reactions{}, false, fmt.Errorf("%s: %w", ReactionsFile, err)
	}
	return out, true, nil
}

// ReactionRow is one row of species_reaction with the keys of its sources.
type ReactionRow struct {
	SpeciesID       db.ID
	Position        int
	Reagent         string
	Reading         string
	Part            *enums.BodyPart
	Location        *string
	Result          string
	ColourName      *string
	ColourHex       *string
	Contested       bool
	PartlyConfirmed bool
	SourceKeys      []string
}

// ReactionPlan is what the reaction sync writes, and what it could not match.
type ReactionPlan struct {
	Species        []db.ID
	Rows           []ReactionRow
	Unmatched      []string
	UnknownReagent []string
}

// Reagents gives the sorted slugs of the reagents that the rows use.
func (p ReactionPlan) Reagents() []string {
	slugs := make([]string, len(p.Rows))
	for i, row := range p.Rows {
		slugs[i] = row.Reagent
	}
	return sortedSet(slugs)
}

var reactionResults = []string{"positive", "negative", "variable", "unknown"}

// PlanReactions matches each reaction to a species and builds its row.
// The match function gives the species of a latin name. The function writes nothing.
func PlanReactions(file Reactions, match func(latin string) (db.ID, bool), colours map[string]string) ReactionPlan {
	plan := ReactionPlan{}
	bySpecies := map[db.ID][]ReactionRow{}
	unmatched := map[string]bool{}
	unknown := map[string]bool{}
	for _, entry := range file.Reactions {
		species, ok := match(entry.Latin)
		if !ok {
			if !unmatched[entry.Latin] {
				unmatched[entry.Latin] = true
				plan.Unmatched = append(plan.Unmatched, entry.Latin)
			}
			continue
		}
		if _, known := ReagentName[entry.Reagent]; !known {
			if !unknown[entry.Reagent] {
				unknown[entry.Reagent] = true
				plan.UnknownReagent = append(plan.UnknownReagent, entry.Reagent)
			}
			continue
		}
		if _, seen := bySpecies[species]; !seen {
			plan.Species = append(plan.Species, species)
		}
		row := reactionRow(entry, colours)
		row.SpeciesID = species
		row.Position = len(bySpecies[species])
		bySpecies[species] = append(bySpecies[species], row)
	}
	for _, species := range plan.Species {
		plan.Rows = append(plan.Rows, bySpecies[species]...)
	}
	return plan
}

func reactionRow(entry ReactionEntry, colours map[string]string) ReactionRow {
	result := entry.Result
	if !slices.Contains(reactionResults, result) {
		result = "unknown"
	}
	row := ReactionRow{
		Reagent:         entry.Reagent,
		Reading:         entry.Reading,
		Location:        entry.Part,
		Result:          result,
		Contested:       entry.Contested,
		PartlyConfirmed: entry.PartlyConfirmed,
		SourceKeys:      uniqueInOrder(entry.Sources),
	}
	if entry.PartSlug != nil && enums.BodyPart(*entry.PartSlug).Valid() {
		part := enums.BodyPart(*entry.PartSlug)
		row.Part = &part
	}
	if result == "positive" || result == "variable" {
		if name, hex, ok := FindColour(entry.Reading, colours); ok {
			row.ColourName, row.ColourHex = &name, &hex
		}
	}
	return row
}

// uniqueInOrder keeps the first of each key, in list order.
func uniqueInOrder(keys []string) []string {
	var out []string
	for _, key := range keys {
		if !slices.Contains(out, key) {
			out = append(out, key)
		}
	}
	return out
}

type catalogueNames struct {
	latin    map[string]db.ID
	synonyms map[string]db.ID
	slugs    map[string]db.ID
}

func loadNames(ctx context.Context, q db.Querier) (catalogueNames, error) {
	type named struct {
		id   db.ID
		a, b string
	}
	scan := func(s db.Scanner) (named, error) {
		var n named
		return n, s.Scan(&n.id, &n.a, &n.b)
	}
	species, err := db.All(ctx, q, scan, "SELECT id, latin_name, slug FROM species ORDER BY latin_name")
	if err != nil {
		return catalogueNames{}, err
	}
	synonyms, err := db.All(ctx, q, scan,
		"SELECT species_id, name, kind FROM species_name WHERE kind = ? ORDER BY species_id, position", enums.NameKindSynonym)
	if err != nil {
		return catalogueNames{}, err
	}
	out := catalogueNames{latin: map[string]db.ID{}, synonyms: map[string]db.ID{}, slugs: map[string]db.ID{}}
	for _, s := range species {
		out.latin[strings.ToLower(s.a)] = s.id
		out.slugs[s.b] = s.id
	}
	for _, s := range synonyms {
		key := strings.ToLower(s.a)
		if _, taken := out.synonyms[key]; !taken {
			out.synonyms[key] = s.id
		}
	}
	return out, nil
}

// matcher finds a species by latin name, then by synonym, then by a manual
// match. A manual match names a species slug or the stem of a profile.
func matcher(names catalogueNames, profiles []StemProfile) func(string) (db.ID, bool) {
	stems := map[string]string{}
	for _, p := range profiles {
		stems[p.Stem] = strings.ToLower(p.Profile.Lateinisch)
	}
	return func(latin string) (db.ID, bool) {
		key := strings.ToLower(strings.TrimSpace(latin))
		if id, ok := names.latin[key]; ok {
			return id, true
		}
		if id, ok := names.synonyms[key]; ok {
			return id, true
		}
		target, ok := ManualMatches[key]
		if !ok {
			return db.ID{}, false
		}
		if id, ok := names.slugs[target]; ok {
			return id, true
		}
		id, ok := names.latin[stems[target]]
		return id, ok
	}
}

// ReactionReport counts the result of one reaction sync.
type ReactionReport struct {
	Species        int
	Reactions      int
	Sources        int
	NewTerms       []string
	Unmatched      []string
	UnknownReagent []string
}

// SyncReactions replaces the reactions of each matched species with those of
// daten/reaktionen.json, in one transaction. It adds missing reagent terms.
func SyncReactions(ctx context.Context, handle *sql.DB, data fs.FS, profiles []StemProfile) (ReactionReport, error) {
	file, found, err := LoadReactions(data)
	if err != nil || !found {
		return ReactionReport{}, err
	}
	colours := ColourVocabulary(profiles)
	return db.InTxValue(ctx, handle, func(tx *sql.Tx) (ReactionReport, error) {
		names, err := loadNames(ctx, tx)
		if err != nil {
			return ReactionReport{}, err
		}
		plan := PlanReactions(file, matcher(names, profiles), colours)
		terms, added, err := ensureReagentTerms(ctx, tx, plan.Reagents())
		if err != nil {
			return ReactionReport{}, err
		}
		sources, err := upsertSources(ctx, tx, file.Sources)
		if err != nil {
			return ReactionReport{}, err
		}
		if err := writeReactions(ctx, tx, plan, terms, sources); err != nil {
			return ReactionReport{}, err
		}
		return ReactionReport{
			Species:        len(plan.Species),
			Reactions:      len(plan.Rows),
			Sources:        len(file.Sources),
			NewTerms:       added,
			Unmatched:      plan.Unmatched,
			UnknownReagent: plan.UnknownReagent,
		}, nil
	})
}

// ensureReagentTerms gives the trigger term of each slug. A missing term is
// added behind the last trigger.
func ensureReagentTerms(ctx context.Context, tx *sql.Tx, slugs []string) (map[string]db.ID, []string, error) {
	type term struct {
		id   db.ID
		slug string
	}
	existing, err := db.All(ctx, tx, func(s db.Scanner) (term, error) {
		var t term
		return t, s.Scan(&t.id, &t.slug)
	}, "SELECT id, slug FROM term WHERE kind = ? ORDER BY position, name", enums.TermKindTrigger)
	if err != nil {
		return nil, nil, err
	}
	ids := map[string]db.ID{}
	for _, t := range existing {
		if _, ok := ids[t.slug]; !ok {
			ids[t.slug] = t.id
		}
	}
	missing := slices.DeleteFunc(slices.Clone(slugs), func(slug string) bool { _, ok := ids[slug]; return ok })
	if len(missing) == 0 {
		return ids, nil, nil
	}
	last, err := db.Scalar[int](ctx, tx, "SELECT coalesce(max(position), -1) FROM term WHERE kind = ?", enums.TermKindTrigger)
	if err != nil {
		return nil, nil, err
	}
	for i, slug := range missing {
		id := db.NewID()
		if _, err := tx.ExecContext(ctx,
			"INSERT INTO term (id, kind, group_key, slug, name, position) VALUES (?, ?, ?, ?, ?, ?)",
			id, enums.TermKindTrigger, enums.TriggerGroupReagent, slug, ReagentName[slug], last+1+i); err != nil {
			return nil, nil, err
		}
		ids[slug] = id
	}
	return ids, missing, nil
}

// upsertSources writes each source by its key and gives the row key of each.
func upsertSources(ctx context.Context, tx *sql.Tx, sources []ReactionSource) (map[string]db.ID, error) {
	rows := rowsOf(sources, func(s ReactionSource) []any { return []any{db.NewID(), s.ID, s.Label, s.URL, s.Year} })
	err := execMany(ctx, tx, `INSERT INTO reaction_source (id, "key", label, url, year) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT ("key") DO UPDATE SET label = excluded.label, url = excluded.url, year = excluded.year`, rows)
	if err != nil {
		return nil, err
	}
	type source struct {
		id  db.ID
		key string
	}
	stored, err := db.All(ctx, tx, func(s db.Scanner) (source, error) {
		var out source
		return out, s.Scan(&out.id, &out.key)
	}, `SELECT id, "key" FROM reaction_source`)
	if err != nil {
		return nil, err
	}
	out := make(map[string]db.ID, len(stored))
	for _, s := range stored {
		out[s.key] = s.id
	}
	return out, nil
}

func writeReactions(ctx context.Context, tx *sql.Tx, plan ReactionPlan, terms, sources map[string]db.ID) error {
	stale := rowsOf(plan.Species, func(id db.ID) []any { return []any{id} })
	if err := execMany(ctx, tx, "DELETE FROM species_reaction WHERE species_id = ?", stale); err != nil {
		return err
	}
	reactions := rowsOf(plan.Rows, func(r ReactionRow) []any {
		return []any{r.SpeciesID, r.Position, terms[r.Reagent], r.Reading, r.Part, r.Location, r.Result,
			r.ColourName, r.ColourHex, r.Contested, r.PartlyConfirmed}
	})
	err := execMany(ctx, tx, `INSERT INTO species_reaction (species_id, position, term_id, reading, part, location,
		result, colour_name, colour_hex, contested, partly_confirmed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, reactions)
	if err != nil {
		return err
	}
	var links [][]any
	for _, r := range plan.Rows {
		for _, key := range r.SourceKeys {
			if id, ok := sources[key]; ok {
				links = append(links, []any{r.SpeciesID, r.Position, id})
			}
		}
	}
	return execMany(ctx, tx, "INSERT INTO species_reaction_source (species_id, position, source_id) VALUES (?, ?, ?)", links)
}

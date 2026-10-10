package catalog_test

import (
	"context"
	"fmt"
	"io/fs"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	backend "github.com/frederikbeimgraben/kinoko/backend"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

// seedWithoutSpecies is the seed data without the species profiles. The
// tests make their own catalogue.
func seedWithoutSpecies(t testing.TB) fs.FS {
	t.Helper()
	data, err := fs.Sub(backend.Data, "daten")
	if err != nil {
		t.Fatal(err)
	}
	out := fstest.MapFS{"arten": &fstest.MapFile{Mode: fs.ModeDir | 0o755}}
	err = fs.WalkDir(data, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || strings.HasPrefix(path, "arten/") {
			return err
		}
		body, err := fs.ReadFile(data, path)
		out[path] = &fstest.MapFile{Data: body, Mode: 0o644}
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

var emptySeed fs.FS

// newEnv starts the service with an empty catalogue.
func newEnv(t *testing.T) *testkit.Env {
	t.Helper()
	if emptySeed == nil {
		emptySeed = seedWithoutSpecies(t)
	}
	env := testkit.New(t, testkit.WithData(emptySeed))
	for _, statement := range []string{
		"DELETE FROM species", "DELETE FROM term", "DELETE FROM taxon", "DELETE FROM reaction_source",
		`INSERT OR IGNORE INTO permission ("key", area) VALUES ('species.edit', 'species')`,
	} {
		exec(t, env, statement)
	}
	module(t, env).ForgetBundle()
	return env
}

func module(t *testing.T, env *testkit.Env) *catalog.Module {
	t.Helper()
	for _, m := range env.Service.Modules {
		if found, ok := m.(*catalog.Module); ok {
			return found
		}
	}
	t.Fatal("no catalog module")
	return nil
}

func exec(t *testing.T, env *testkit.Env, query string, args ...any) {
	t.Helper()
	if _, err := env.DB.ExecContext(context.Background(), query, args...); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
}

func scalar[T any](t *testing.T, env *testkit.Env, query string, args ...any) T {
	t.Helper()
	value, err := db.Scalar[T](context.Background(), env.DB, query, args...)
	if err != nil {
		t.Fatal(err)
	}
	return value
}

var editor = testkit.Admin()

type taxon struct {
	ID   db.ID
	Rank string
	Slug string
}

func makeTaxon(t *testing.T, env *testkit.Env, rank, slug, name string, parent *taxon) taxon {
	t.Helper()
	if name == "" {
		name = slug
	}
	made := taxon{db.NewID(), rank, slug}
	var parentID *db.ID
	if parent != nil {
		parentID = &parent.ID
	}
	exec(t, env, "INSERT INTO taxon (id, rank, slug, name, latin_name, parent_id) VALUES (?, ?, ?, ?, ?, ?)",
		made.ID, rank, slug, name, name, parentID)
	return made
}

type term struct {
	ID   db.ID
	Kind string
	Slug string
	Name string
}

func makeTerm(t *testing.T, env *testkit.Env, kind, slug, name string, group *string, position int) term {
	t.Helper()
	made := term{db.NewID(), kind, slug, name}
	exec(t, env, "INSERT INTO term (id, kind, group_key, slug, name, position) VALUES (?, ?, ?, ?, ?, ?)",
		made.ID, kind, group, slug, name, position)
	return made
}

type species struct {
	ID        db.ID
	Slug      string
	Name      string
	LatinName string
}

// extra holds more columns of the table species.
type extra map[string]any

var clock = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

// makeSpecies adds a species. Each species gets a later updated_at.
func makeSpecies(t *testing.T, env *testkit.Env, slug, name, latin string, taxonOf *taxon, more extra) species {
	t.Helper()
	if name == "" {
		name = slug
	}
	if latin == "" {
		latin = name
	}
	made := species{db.NewID(), slug, name, latin}
	var taxonID *db.ID
	if taxonOf != nil {
		taxonID = &taxonOf.ID
	}
	clock = clock.Add(time.Second)
	columns := map[string]any{
		"id": made.ID, "slug": slug, "name": name, "latin_name": latin, "taxon_id": taxonID,
		"group_key": "bolete", "edibility": "edible", "protection": "none", "marketable": false,
		"forecast_enabled": false, "updated_at": db.At(clock),
	}
	for key, value := range more {
		columns[key] = value
	}
	names := []string{}
	values := []any{}
	for key, value := range columns {
		names = append(names, key)
		values = append(values, value)
	}
	exec(t, env, fmt.Sprintf("INSERT INTO species (%s) VALUES (%s)", strings.Join(names, ", "),
		db.Placeholders(len(names))), values...)
	return made
}

func touch(t *testing.T, env *testkit.Env, s species, column string, value any) {
	t.Helper()
	clock = clock.Add(time.Second)
	exec(t, env, "UPDATE species SET "+column+" = ?, updated_at = ? WHERE id = ?", value, db.At(clock), s.ID)
}

func addName(t *testing.T, env *testkit.Env, s species, position int, name, kind string) {
	exec(t, env, "INSERT INTO species_name (species_id, position, name, kind) VALUES (?, ?, ?, ?)", s.ID, position, name, kind)
}

func addMeasurement(t *testing.T, env *testkit.Env, s species, part, dimension string, low, high float64) {
	exec(t, env, `INSERT INTO species_measurement (species_id, part, dimension, low, high, unit)
		VALUES (?, ?, ?, ?, ?, 'cm')`, s.ID, part, dimension, low, high)
}

type colour struct{ Name, Hex string }

func addColours(t *testing.T, env *testkit.Env, s species, part, mode string, colours ...colour) {
	exec(t, env, "INSERT INTO species_colour_range (species_id, part, mode) VALUES (?, ?, ?)", s.ID, part, mode)
	for i, c := range colours {
		exec(t, env, "INSERT INTO species_colour (species_id, part, position, name, hex) VALUES (?, ?, ?, ?, ?)",
			s.ID, part, i, c.Name, c.Hex)
	}
}

func addColourChange(t *testing.T, env *testkit.Env, s species, position int, part, toName, toHex string, triggers ...term) {
	exec(t, env, `INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
		VALUES (?, ?, ?, ?, ?)`, s.ID, position, part, toName, toHex)
	for _, tr := range triggers {
		exec(t, env, "INSERT INTO species_colour_change_trigger (species_id, position, term_id) VALUES (?, ?, ?)",
			s.ID, position, tr.ID)
	}
}

func addPartFeature(t *testing.T, env *testkit.Env, s species, part, feature, phase string) {
	exec(t, env, "INSERT INTO species_part_feature (species_id, part, feature, phase) VALUES (?, ?, ?, ?)",
		s.ID, part, feature, phase)
}

func addTrait(t *testing.T, env *testkit.Env, s species, key, text string) {
	exec(t, env, `INSERT INTO species_trait (species_id, "key", body) VALUES (?, ?, ?)`, s.ID, key, text)
}

func addSource(t *testing.T, env *testkit.Env, s species, position int, scope, title, url, checked string) {
	exec(t, env, `INSERT INTO species_source (species_id, position, scope, title, url, checked_on)
		VALUES (?, ?, ?, ?, ?, ?)`, s.ID, position, scope, title, url, checked)
}

func addSeason(t *testing.T, env *testkit.Env, s species, season string) {
	exec(t, env, "INSERT INTO species_season (species_id, season) VALUES (?, ?)", s.ID, season)
}

func addTerm(t *testing.T, env *testkit.Env, s species, tr term, fromExperience bool) {
	exec(t, env, "INSERT INTO species_term (species_id, term_id, from_experience) VALUES (?, ?, ?)",
		s.ID, tr.ID, fromExperience)
}

// addLookalike adds a pair in the order that the table needs.
func addLookalike(t *testing.T, env *testkit.Env, a, b species, differenceA, differenceB *string) {
	first, second := a.ID, b.ID
	if second.String() < first.String() {
		first, second, differenceA, differenceB = second, first, differenceB, differenceA
	}
	exec(t, env, `INSERT INTO species_lookalike (species_a_id, species_b_id, difference_a, difference_b)
		VALUES (?, ?, ?, ?)`, first, second, differenceA, differenceB)
}

// addLeadPhoto adds an approved lead photo. Each photo gets a later time.
func addLeadPhoto(t *testing.T, env *testkit.Env, s species) db.ID {
	id := db.NewID()
	clock = clock.Add(time.Second)
	exec(t, env, `INSERT INTO photo (id, species_id, width, height, photographer, licence, lead, state, created_at, updated_at)
		VALUES (?, ?, 10, 10, 'tester', 'own', 1, 'approved', ?, ?)`, id, s.ID, db.At(clock), db.At(clock))
	return id
}

func setPhotoLead(t *testing.T, env *testkit.Env, photo db.ID, lead bool) {
	clock = clock.Add(time.Second)
	exec(t, env, "UPDATE photo SET lead = ?, updated_at = ? WHERE id = ?", lead, db.At(clock), photo)
}

func makeUser(t *testing.T, env *testkit.Env, sub, name string) db.ID {
	id := db.NewID()
	exec(t, env, "INSERT INTO user (id, sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)",
		id, sub, sub+"@example.test", name, db.Now())
	return id
}

func addFind(t *testing.T, env *testkit.Env, s species, owner db.ID) {
	exec(t, env, `INSERT INTO find (id, owner_id, species_id, lat, lon, found_on, for_training, review_state,
		visibility, created_at, updated_at) VALUES (?, ?, ?, 0, 0, '2025-01-01', 0, 'open', 'private', ?, ?)`,
		db.NewID(), owner, s.ID, db.Now(), db.Now())
}

func makeRun(t *testing.T, env *testkit.Env, queued time.Time) db.ID {
	id := db.NewID()
	exec(t, env, `INSERT INTO pipeline_run (id, kind, state, queued_at, progress_done, progress_total)
		VALUES (?, 'training', 'queued', ?, 0, 0)`, id, db.At(queued))
	return id
}

func addRunSpecies(t *testing.T, env *testkit.Env, run db.ID, s species, state string, records int) {
	exec(t, env, `INSERT INTO pipeline_run_species (run_id, species_id, state, record_count, find_count)
		VALUES (?, ?, ?, ?, 0)`, run, s.ID, state, records)
}

func ptr[T any](v T) *T { return &v }

// slugsOf gives the slugs of the items of a page.
func slugsOf(t *testing.T, r testkit.Response) []string {
	t.Helper()
	body := r.Expect(t, 200).Map(t)
	items, _ := body["items"].([]any)
	out := []string{}
	for _, item := range items {
		out = append(out, item.(map[string]any)["slug"].(string))
	}
	return out
}

package catalog_test

import (
	"io/fs"
	"net/http"
	"testing"

	backend "github.com/frederikbeimgraben/kinoko/backend"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

// importedEnv starts the service with the whole seed, so the start imports the catalogue.
func importedEnv(t *testing.T) *testkit.Env {
	t.Helper()
	if testing.Short() {
		t.Skip("the import takes some seconds")
	}
	return testkit.New(t)
}

func profileCount(t *testing.T) int {
	names, err := fs.Glob(backend.Data, "daten/arten/*.toml")
	if err != nil {
		t.Fatal(err)
	}
	return len(names)
}

func TestImportedCatalogueThroughTheAPI(t *testing.T) {
	env := importedEnv(t)

	t.Run("the species list serves every profile", func(t *testing.T) {
		found := 0
		cursor := ""
		for {
			path := "/species?limit=40"
			if cursor != "" {
				path += "&cursor=" + cursor
			}
			body := env.Get(path, nil).Expect(t, http.StatusOK).Map(t)
			for _, item := range list(body["items"]) {
				if obj(item)["slug"] == "" {
					t.Fatal(item)
				}
				found++
			}
			next, ok := body["nextCursor"].(string)
			if !ok {
				break
			}
			cursor = next
		}
		if found != profileCount(t) {
			t.Fatal(found, profileCount(t))
		}
	})

	t.Run("a known species comes from the table", func(t *testing.T) {
		body := profileOf(t, env, "boletus-edulis")
		if body["scientificName"] != "Boletus edulis" || body["edibility"] != "edible" ||
			body["group"] != "bolete" || body["protection"] != "personal_use" {
			t.Fatal(body)
		}
		if len(list(body["lookalikes"])) == 0 {
			t.Fatal(body["lookalikes"])
		}
		parts := map[any]bool{}
		for _, g := range list(body["colours"]) {
			parts[obj(g)["part"]] = true
		}
		for _, g := range list(body["measurements"]) {
			parts["measured "+obj(g)["part"].(string)] = true
		}
		if !parts["cap"] || !parts["measured spore"] {
			t.Fatal(parts)
		}
	})

	t.Run("the bundle carries every species", func(t *testing.T) {
		body := bundleOf(t, env)
		if len(items(body)) != profileCount(t) || len(list(body["standardColours"])) != 12 {
			t.Fatal(len(items(body)))
		}
	})

	t.Run("a species shows its imported reactions", func(t *testing.T) {
		slug := scalar[string](t, env, `SELECT s.slug FROM species s JOIN species_reaction r ON r.species_id = s.id
			GROUP BY s.id ORDER BY count(*) DESC LIMIT 1`)
		want := scalar[int](t, env, `SELECT count(*) FROM species_reaction r JOIN species s ON s.id = r.species_id
			WHERE s.slug = ?`, slug)
		if got := len(list(profileOf(t, env, slug)["reactions"])); got != want || want == 0 {
			t.Fatal(slug, got, want)
		}
	})
}

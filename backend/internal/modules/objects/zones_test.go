package objects_test

import (
	"fmt"
	"math"
	"net/http"
	"net/url"
	"path/filepath"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/objects"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

var square = object{
	"type": "Polygon",
	"coordinates": [][][]float64{{
		{8.60, 50.10}, {8.62, 50.10}, {8.62, 50.12}, {8.60, 50.12}, {8.60, 50.10},
	}},
}

var squareRing = geo.RingOf([2]float64{8.60, 50.10}, [2]float64{8.62, 50.10}, [2]float64{8.62, 50.12}, [2]float64{8.60, 50.12}, [2]float64{8.60, 50.10})

func aZone(name string) object { return object{"name": name, "polygon": square} }

// writeMap writes the manifest and one value tile of a species under the maps folder.
func writeMap(t *testing.T, env *testkit.Env, slug string, ring geo.Ring, value uint8) {
	t.Helper()
	zoom := 8
	x, y := objects.FirstCell(ring, zoom)
	path := slug + "/2026-37"
	writeJSON(t, env.Settings.Maps, slug+".json", object{
		"name":  slug,
		"top":   0.5,
		"weeks": []object{{"year": 2026, "week": 37, "tiles": path}},
		"tiles": object{"have": object{fmt.Sprint(zoom): []string{fmt.Sprintf("%d/%d", x, y)}}},
	})
	writeTile(t, filepath.Join(env.Settings.Maps, path), zoom, x, y, value, objects.TileSize)
}

func zoneValuePath(zone string, species db.ID, week int) string {
	return fmt.Sprintf("/zones/%s/value?speciesId=%s&year=2026&week=%d", zone, species, week)
}

func TestCreateComputesArea(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	created := env.Post("/zones", aZone("Wald"), anna.Person).Expect(t, http.StatusCreated).Map(t)
	// The value comes from geometry.area_ha of the Python service.
	if created["areaHa"] != 317.1903477050781 {
		t.Fatal(created)
	}
}

func TestZoneIsStoredAsPydanticJSON(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/zones", aZone("Wald"), anna.Person).Expect(t, http.StatusCreated).Map(t)["id"].(string)
	parsed, _ := db.ParseID(id)
	var stored string
	if err := env.DB.QueryRow("SELECT polygon FROM zone WHERE id = ?", parsed).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	want := `{"type":"Polygon","coordinates":[[[8.6,50.1],[8.62,50.1],[8.62,50.12],[8.6,50.12],[8.6,50.1]]]}`
	if stored != want {
		t.Fatal(stored)
	}
	body := env.Get("/zones/"+id, anna.Person).Expect(t, http.StatusOK).Body
	if keys := keysOf(t, body); keys != `"id","ownerId","name","polygon","areaHa","colour","visibility","groupId","note","createdAt","updatedAt","deleted"` {
		t.Fatal(keys)
	}
}

func TestGetAZone(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/zones", aZone("Wald"), anna.Person).Map(t)["id"].(string)
	env.Get("/zones/"+id, anna.Person).Expect(t, http.StatusOK)
}

func TestZoneListAndChangesSince(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/zones", aZone("Wald"), anna.Person).Map(t)["id"].(string)
	if listed := items(t, env.Get("/zones", anna.Person)); len(listed) != 1 {
		t.Fatal(listed)
	}
	since := ids(items(t, env.Get("/zones?since="+url.QueryEscape("1970-01-01T00:00:00Z"), anna.Person)))
	if len(since) != 1 || since[0] != id {
		t.Fatal(since)
	}
}

func TestPutReplacesAZone(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := db.NewID().String()
	env.Put("/zones/"+id, aZone("Alt"), anna.Person).Expect(t, http.StatusCreated)
	if second := env.Put("/zones/"+id, aZone("Neu"), anna.Person).Expect(t, http.StatusOK).Map(t); second["name"] != "Neu" {
		t.Fatal(second)
	}
}

func TestPutOfForeignZoneIsNotFound(t *testing.T) {
	env := testkit.New(t)
	anna, bert := makeUser(t, env, "anna"), makeUser(t, env, "bert")
	id := db.NewID().String()
	env.Put("/zones/"+id, aZone("Anna"), anna.Person).Expect(t, http.StatusCreated)
	env.Put("/zones/"+id, aZone("Bert"), bert.Person).Expect(t, http.StatusNotFound)
}

func TestDeleteAZone(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/zones", aZone("Wald"), anna.Person).Map(t)["id"].(string)
	env.Delete("/zones/"+id, anna.Person).Expect(t, http.StatusNoContent)
	env.Get("/zones/"+id, anna.Person).Expect(t, http.StatusNotFound)
}

func TestZoneValueWithoutManifestIsZero(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/zones", aZone("Wald"), anna.Person).Map(t)["id"].(string)
	body := env.Get(zoneValuePath(id, db.NewID(), 37), anna.Person).Expect(t, http.StatusOK)
	if keys := keysOf(t, body.Body); keys != `"speciesId","year","week","areaMean","points","ownFinds"` {
		t.Fatal(keys)
	}
	value := body.Map(t)
	if value["areaMean"] != 0.0 || value["points"] != 0.0 || value["ownFinds"] != 0.0 {
		t.Fatal(value)
	}
}

func TestZoneValueReadsTheManifest(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/zones", aZone("Wald"), anna.Person).Map(t)["id"].(string)
	species := makeSpecies(t, env, "probe-species", enums.ProtectionNone)
	writeMap(t, env, "probe-species", squareRing, 255)
	value := env.Get(zoneValuePath(id, species, 37), anna.Person).Expect(t, http.StatusOK).Map(t)
	if value["points"].(float64) <= 0 || math.Abs(value["areaMean"].(float64)-50.0) >= 0.5 {
		t.Fatal(value)
	}
}

func TestZoneValueWithoutTheWeekIsZero(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/zones", aZone("Wald"), anna.Person).Map(t)["id"].(string)
	species := makeSpecies(t, env, "probe-species", enums.ProtectionNone)
	writeMap(t, env, "probe-species", squareRing, 255)
	if value := env.Get(zoneValuePath(id, species, 1), anna.Person).Map(t); value["points"] != 0.0 {
		t.Fatal(value)
	}
}

func TestZoneValueCountsOwnFinds(t *testing.T) {
	env := testkit.New(t)
	anna := makeUser(t, env, "anna")
	id := env.Post("/zones", aZone("Wald"), anna.Person).Map(t)["id"].(string)
	species := makeSpecies(t, env, "probe-species", enums.ProtectionNone)
	env.Post("/finds", object{"speciesId": species.String(), "lat": 50.11, "lon": 8.61, "foundOn": "2026-09-01"}, anna.Person).
		Expect(t, http.StatusCreated)
	env.Post("/finds", object{"speciesId": species.String(), "lat": 51.0, "lon": 9.0, "foundOn": "2026-09-01"}, anna.Person).
		Expect(t, http.StatusCreated)
	if value := env.Get(zoneValuePath(id, species, 37), anna.Person).Map(t); value["ownFinds"] != 1.0 {
		t.Fatal(value)
	}
}

func TestZoneValueOfForeignZoneIsNotFound(t *testing.T) {
	env := testkit.New(t)
	anna, bert := makeUser(t, env, "anna"), makeUser(t, env, "bert")
	id := env.Post("/zones", aZone("Wald"), anna.Person).Map(t)["id"].(string)
	env.Get(zoneValuePath(id, db.NewID(), 37), bert.Person).Expect(t, http.StatusNotFound)
}

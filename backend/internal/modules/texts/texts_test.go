package texts_test

import (
	"context"
	"database/sql"
	"maps"
	"net/http"
	"regexp"
	"slices"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/texts"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

type entry struct {
	Key       string            `json:"key"`
	Values    map[string]string `json:"values"`
	Changed   bool              `json:"changed"`
	UpdatedAt string            `json:"updatedAt"`
}

type catalogue struct {
	Revision string   `json:"revision"`
	Locales  []string `json:"locales"`
	Entries  []entry  `json:"entries"`
}

func TestSeedWritesEveryKeyOfTheFile(t *testing.T) {
	handle := emptySchema(t)
	report, err := texts.Seed(context.Background(), handle, embedded(t), db.Now())
	if err != nil {
		t.Fatal(err)
	}
	if !maps.Equal(storedPairs(t, handle), wanted(t)) {
		t.Fatal("stored keys differ from the seed file")
	}
	if report.Added != len(wanted(t)) {
		t.Fatalf("added %d, expected %d", report.Added, len(wanted(t)))
	}
}

func TestSyncWritesOnlyMissingKeys(t *testing.T) {
	handle := emptySchema(t)
	first, err := texts.Seed(context.Background(), handle, embedded(t), db.Now())
	if err != nil || first.Added == 0 {
		t.Fatal(first, err)
	}
	again, err := texts.Seed(context.Background(), handle, embedded(t), db.Now())
	if err != nil || again.Touched() != 0 {
		t.Fatal(again, err)
	}
}

func TestCatalogueHoldsTheWholeFile(t *testing.T) {
	env := testkit.New(t)
	answer := env.Get("/texts", nil).Expect(t, http.StatusOK)
	body := testkit.JSON[catalogue](t, answer)
	pairs := map[pair]struct{}{}
	for _, entry := range body.Entries {
		for locale := range entry.Values {
			pairs[pair{entry.Key, locale}] = struct{}{}
		}
	}
	if !maps.Equal(pairs, wanted(t)) {
		t.Fatal("catalogue differs from the seed file")
	}
	if !regexp.MustCompile(`^W/"[0-9a-f]{16}"$`).MatchString(answer.Header.Get("ETag")) {
		t.Fatalf("etag %q", answer.Header.Get("ETag"))
	}
}

func TestCatalogueHasBothLocales(t *testing.T) {
	env := testkit.New(t)
	body := testkit.JSON[catalogue](t, env.Get("/texts", nil).Expect(t, http.StatusOK))
	if !slices.Equal(body.Locales, []string{"de", "en"}) || body.Revision == "" {
		t.Fatal(body.Locales, body.Revision)
	}
	if !slices.ContainsFunc(body.Entries, func(e entry) bool { return e.Key == "error.notFound" }) {
		t.Fatal("error.notFound is missing")
	}
	for _, entry := range body.Entries {
		if entry.Changed {
			t.Fatalf("%s is changed", entry.Key)
		}
		if !regexp.MustCompile(`\+00:00$`).MatchString(entry.UpdatedAt) {
			t.Fatalf("updatedAt %q", entry.UpdatedAt)
		}
	}
}

func TestEtagAnswers304(t *testing.T) {
	env := testkit.New(t)
	tag := env.Get("/texts", nil).Expect(t, http.StatusOK).Header.Get("ETag")
	again := env.Do(testkit.Request{Method: http.MethodGet, Path: "/texts", Header: http.Header{"If-None-Match": {tag}}})
	again.Expect(t, http.StatusNotModified)
	if again.Header.Get("ETag") != tag || len(again.Body) != 0 {
		t.Fatal(again.Header, string(again.Body))
	}
}

func TestEtagChangesWithARow(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	before := env.Get("/texts", nil).Header.Get("ETag")
	env.Put("/texts/common.save", map[string]string{"locale": "de", "value": "Sichern"}, editor()).Expect(t, http.StatusOK)
	after := env.Get("/texts", nil).Header.Get("ETag")
	if before == after {
		t.Fatal("etag stays the same after a change")
	}
}

func TestPutNeedsTheRight(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	env.Put("/texts/common.save", map[string]string{"locale": "de", "value": "Sichern"},
		testkit.Ptr(testkit.Someone("redaktion"))).Expect(t, http.StatusForbidden)
}

func TestPutAndReset(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	answer := env.Put("/texts/common.save", map[string]string{"locale": "de", "value": "Sichern"}, editor()).
		Expect(t, http.StatusOK).Map(t)
	if answer["values"].(map[string]any)["de"] != "Sichern" || answer["changed"] != true {
		t.Fatal(answer)
	}
	env.Do(testkit.Request{Method: http.MethodDelete, Path: "/texts/common.save?locale=de", As: editor()}).
		Expect(t, http.StatusNoContent)
	body := testkit.JSON[catalogue](t, env.Get("/texts", nil))
	for _, entry := range body.Entries {
		if entry.Key == "common.save" && entry.Changed {
			t.Fatal("common.save is still changed")
		}
	}
}

func TestUnknownKeyIsNotFound(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	missing := env.Put("/texts/gibt.es.nicht", map[string]string{"locale": "de", "value": "x"}, editor()).
		Expect(t, http.StatusNotFound).Map(t)
	if missing["code"] != "not_found" {
		t.Fatal(missing)
	}
	env.Do(testkit.Request{Method: http.MethodDelete, Path: "/texts/gibt.es.nicht?locale=de", As: editor()}).
		Expect(t, http.StatusNotFound)
}

func TestNewLocaleOfAKnownKey(t *testing.T) {
	env := testkit.New(t)
	grantTextEdit(t, env)
	answer := env.Put("/texts/common.save", map[string]string{"locale": "fr", "value": "Enregistrer"}, editor()).
		Expect(t, http.StatusOK).Map(t)
	if answer["values"].(map[string]any)["fr"] != "Enregistrer" {
		t.Fatal(answer)
	}
	env.Do(testkit.Request{Method: http.MethodDelete, Path: "/texts/common.save?locale=fr", As: editor()}).
		Expect(t, http.StatusNoContent)
	if slices.Contains(testkit.JSON[catalogue](t, env.Get("/texts", nil)).Locales, "fr") {
		t.Fatal("the fr row without a seed value stays")
	}
}

func TestChangeOfUnknownKeyRaises(t *testing.T) {
	env := testkit.New(t)
	err := texts.Reset(context.Background(), env.DB, texts.Defaults{}, "gibt.es.nicht", "de", db.Now())
	if err == nil || err.Error() != "not_found" {
		t.Fatal(err)
	}
}

func TestTitlesReachTheErrors(t *testing.T) {
	env := testkit.New(t)
	answer := env.Get("/nirgendwo", nil).Expect(t, http.StatusNotFound).Map(t)
	if answer["title"] != "Nicht gefunden" {
		t.Fatal(answer)
	}
}

func seedWith(t *testing.T, handle *sql.DB, data texts.Defaults, now db.Time) texts.SeedReport {
	t.Helper()
	report, err := texts.Seed(context.Background(), handle, source(t, data), now)
	if err != nil {
		t.Fatal(err)
	}
	return report
}

func onlyRow(t *testing.T, handle *sql.DB) (value string, updatedBy *db.ID) {
	t.Helper()
	if err := handle.QueryRow(`SELECT value, updated_by_id FROM text`).Scan(&value, &updatedBy); err != nil {
		t.Fatal(err)
	}
	return value, updatedBy
}

func TestSyncFollowsAChangedDefault(t *testing.T) {
	handle := emptySchema(t)
	start := db.Now()
	seedWith(t, handle, texts.Defaults{"de": {"admin.size": "Maße"}}, start)
	before, err := texts.Read(context.Background(), handle)
	if err != nil {
		t.Fatal(err)
	}

	report := seedWith(t, handle, texts.Defaults{"de": {"admin.size": "Abmessungen"}}, db.At(start.Add(time.Second)))

	value, by := onlyRow(t, handle)
	if value != "Abmessungen" || by != nil {
		t.Fatal(value, by)
	}
	if report != (texts.SeedReport{Updated: 1}) {
		t.Fatal(report)
	}
	after, err := texts.Read(context.Background(), handle)
	if err != nil {
		t.Fatal(err)
	}
	if after.Revision == before.Revision {
		t.Fatal("revision stays the same")
	}
}

func TestSyncLeavesATextChangedByHand(t *testing.T) {
	handle := emptySchema(t)
	seedWith(t, handle, texts.Defaults{"de": {"admin.size": "Maße"}}, db.Now())
	user := makeUser(t, handle, "redaktion")
	if _, err := handle.Exec(`UPDATE text SET value = 'Von Hand', updated_by_id = ?`, user); err != nil {
		t.Fatal(err)
	}

	report := seedWith(t, handle, texts.Defaults{"de": {"admin.size": "Abmessungen"}}, db.Now())

	if value, _ := onlyRow(t, handle); value != "Von Hand" || report.Updated != 0 {
		t.Fatal(value, report)
	}
}

func TestSyncRemovesAnOrphanThatNobodyChanged(t *testing.T) {
	handle := emptySchema(t)
	seedWith(t, handle, texts.Defaults{"de": {"admin.size": "Maße", "admin.gone": "Weg"}}, db.Now())

	report := seedWith(t, handle, texts.Defaults{"de": {"admin.size": "Maße"}}, db.Now())

	if !maps.Equal(storedPairs(t, handle), map[pair]struct{}{{"admin.size", "de"}: {}}) {
		t.Fatal(storedPairs(t, handle))
	}
	if report != (texts.SeedReport{Removed: 1}) {
		t.Fatal(report)
	}
}

func TestSyncKeepsAnOrphanChangedByHand(t *testing.T) {
	handle := emptySchema(t)
	seedWith(t, handle, texts.Defaults{"de": {"admin.gone": "Weg"}}, db.Now())
	user := makeUser(t, handle, "redaktion")
	if _, err := handle.Exec(`UPDATE text SET updated_by_id = ?`, user); err != nil {
		t.Fatal(err)
	}

	report := seedWith(t, handle, texts.Defaults{"de": {}}, db.Now())

	if !maps.Equal(storedPairs(t, handle), map[pair]struct{}{{"admin.gone", "de"}: {}}) || report.Removed != 0 {
		t.Fatal(storedPairs(t, handle), report)
	}
}

func TestSeedWithoutFileLeavesTheCatalogueEmpty(t *testing.T) {
	handle := emptySchema(t)
	report, err := texts.Seed(context.Background(), handle, nil, db.Now())
	if err != nil || report.Touched() != 0 {
		t.Fatal(report, err)
	}
	body, err := texts.Read(context.Background(), handle)
	if err != nil || len(body.Entries) != 0 || len(body.Locales) != 0 || body.Locales == nil {
		t.Fatal(body, err)
	}
}

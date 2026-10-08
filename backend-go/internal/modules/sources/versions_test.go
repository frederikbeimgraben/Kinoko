package sources_test

import (
	"context"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
)

func gridFixture(t *testing.T, f *fixture) []byte {
	f.m.UseTreesGridRows(1, 100)
	return sources.ParquetBytes(t, sources.TreesGridColumns(4))
}

func (f *fixture) state(id string) (string, bool) {
	f.t.Helper()
	var state string
	var active bool
	if err := f.env.DB.QueryRow("SELECT state, active FROM data_source_version WHERE id = ?", db.MustID(id)).
		Scan(&state, &active); err != nil {
		f.t.Fatal(err)
	}
	return state, active
}

func versionPath(kind sources.Kind, id string) string {
	return "/data-sources/" + string(kind) + "/versions/" + id
}

func TestReadyUploadIsActiveAndResolved(t *testing.T) {
	f := newFixture(t)
	data := gridFixture(t, f)
	v := f.upload(sources.KindTreesGrid, "trees_de_500m.parquet", data, nil)
	if v["state"] != "ready" || v["active"] != true || v["activatedAt"] == nil || v["processedAt"] == nil {
		t.Fatal(v)
	}
	if v["metadata"].(map[string]any)["rows"] != 4.0 || v["artifacts"].([]any)[0].(map[string]any)["name"] != "trees_de_500m" {
		t.Fatal(v)
	}
	if v["createdBy"].(map[string]any)["name"] != "Admin" {
		t.Fatal(v)
	}
	path, err := f.m.Resolver().Path(sources.KindTreesGrid, "trees_de_500m")
	if err != nil || path != f.m.Abs("sources/trees-grid/v1/original.parquet") {
		t.Fatal(path, err)
	}
	if _, err := f.m.Resolver().Path(sources.KindTreeScales, "tree_scales"); !errors.Is(err, sources.ErrMissing) {
		t.Fatal(err)
	}
	log := f.env.Get(versionPath(sources.KindTreesGrid, v["id"].(string))+"/log?tail=1", f.admin).Expect(t, http.StatusOK).Map(t)
	if lines := log["lines"].([]any); len(lines) != 1 || lines[0] != "ready: 1 artifacts, 0 new versions" {
		t.Fatal(log)
	}
	list := f.env.Get("/data-sources", f.admin).Expect(t, http.StatusOK).Map(t)["items"].([]any)
	byKind := map[string]map[string]any{}
	for _, item := range list {
		byKind[item.(map[string]any)["kind"].(string)] = item.(map[string]any)
	}
	if len(list) != len(sources.Kinds) || byKind["trees-grid"]["state"] != "ready" || byKind["trees-grid"]["required"] != true ||
		byKind["dem"]["state"] != "missing" || byKind["dem"]["activeVersion"] != nil {
		t.Fatal(byKind["trees-grid"], byKind["dem"])
	}
	summary := f.env.Get("/admin/summary", f.admin).Expect(t, http.StatusOK).Map(t)
	if summary["dataSourcesMissing"] != 3.0 || summary["dataSourcesFailed"] != 0.0 {
		t.Fatal(summary)
	}
	missing, err := f.m.Missing(t.Context(), enums.RunKindRender)
	if err != nil || len(missing) != 3 {
		t.Fatal(missing, err)
	}
}

func TestUploadWithoutActivationStaysInactive(t *testing.T) {
	f := newFixture(t)
	v := f.upload(sources.KindTreesGrid, "g.parquet", gridFixture(t, f), map[string]any{"activate": false})
	if v["state"] != "ready" || v["active"] != false {
		t.Fatal(v)
	}
	f.env.Post(versionPath(sources.KindTreesGrid, v["id"].(string))+"/activate", nil, f.admin).Expect(t, http.StatusOK)
	if _, active := f.state(v["id"].(string)); !active {
		t.Fatal("not active")
	}
}

func TestActivationSupersedesAndKeepsTwoForRollback(t *testing.T) {
	f := newFixture(t)
	data := gridFixture(t, f)
	ids := []string{}
	for range 4 {
		ids = append(ids, f.upload(sources.KindTreesGrid, "g.parquet", data, nil)["id"].(string))
	}
	if state, active := f.state(ids[3]); state != "ready" || !active {
		t.Fatal(state, active)
	}
	for _, id := range ids[1:3] {
		if state, active := f.state(id); state != "superseded" || active {
			t.Fatal(id, state, active)
		}
	}
	if n := scalar[int](f, "SELECT count(*) FROM data_source_version WHERE id = ?", db.MustID(ids[0])); n != 0 {
		t.Fatal("version 1 stays")
	}
	if _, err := os.Stat(f.m.Abs("sources/trees-grid/v1")); !os.IsNotExist(err) {
		t.Fatal("the folder of version 1 stays", err)
	}
	f.env.Post(versionPath(sources.KindTreesGrid, ids[1])+"/activate", nil, f.admin).Expect(t, http.StatusOK)
	if state, active := f.state(ids[1]); state != "ready" || !active {
		t.Fatal(state, active)
	}
	if state, active := f.state(ids[3]); state != "superseded" || active {
		t.Fatal(state, active)
	}
	detail := f.env.Get("/data-sources/trees-grid?limit=2", f.admin).Expect(t, http.StatusOK).Map(t)
	if len(detail["versions"].([]any)) != 2 || detail["nextCursor"] == nil ||
		detail["activeVersion"].(map[string]any)["id"] != ids[1] || detail["latestVersion"].(map[string]any)["id"] != ids[3] {
		t.Fatal(detail)
	}
}

func TestDeleteRules(t *testing.T) {
	f := newFixture(t)
	data := gridFixture(t, f)
	only := f.upload(sources.KindTreesGrid, "g.parquet", data, nil)["id"].(string)
	conflict := f.env.Delete(versionPath(sources.KindTreesGrid, only), f.admin).Expect(t, http.StatusConflict).Map(t)
	if conflict["code"] != "in_use" {
		t.Fatal(conflict)
	}
	newer := f.upload(sources.KindTreesGrid, "g.parquet", data, nil)["id"].(string)
	f.env.Delete(versionPath(sources.KindTreesGrid, newer), f.admin).Expect(t, http.StatusNoContent)
	if state, active := f.state(only); state != "ready" || !active {
		t.Fatal("the older version is not active again", state, active)
	}
	if _, err := os.Stat(f.m.Abs("sources/trees-grid/v2")); !os.IsNotExist(err) {
		t.Fatal("the folder stays", err)
	}
	f.env.Delete(versionPath(sources.KindTreeScales, only), f.admin).Expect(t, http.StatusNotFound)
	f.exec(`INSERT INTO pipeline_run (id, kind, state, queued_at, progress_done, progress_total)
		VALUES (?, 'render', 'running', ?, 0, 0)`, db.NewID(), db.Now())
	busy := f.env.Delete(versionPath(sources.KindTreesGrid, only), f.admin).Expect(t, http.StatusConflict).Map(t)
	if busy["code"] != "run_active" {
		t.Fatal(busy)
	}
	f.env.Post(versionPath(sources.KindTreesGrid, only)+"/activate", nil, f.admin).Expect(t, http.StatusConflict)
}

func TestOptionalActiveVersionCanBeDeleted(t *testing.T) {
	f := newFixture(t)
	f.m.UseProcessor(sources.KindDEM, acceptAll{})
	v := f.upload(sources.KindDEM, "dem.tif", []byte("raster"), nil)
	if v["active"] != true {
		t.Fatal(v)
	}
	f.env.Delete(versionPath(sources.KindDEM, v["id"].(string)), f.admin).Expect(t, http.StatusNoContent)
}

// acceptAll accepts each file and derives nothing.
type acceptAll struct{}

func (acceptAll) Validate(context.Context, *sources.Version) (map[string]any, error) {
	return map[string]any{"checked": true}, nil
}

func (acceptAll) Derive(context.Context, *sources.Version) ([]sources.Artifact, error) { return nil, nil }

func TestKindWithoutProcessorFailsAndCanBeReprocessed(t *testing.T) {
	f := newFixture(t)
	v := f.upload(sources.KindGBIFArchive, "fungi.zip", []byte("PK"), nil)
	failure := v["error"].(map[string]any)
	if v["state"] != "failed" || v["active"] != false || failure["code"] != "processor_missing" {
		t.Fatal(v)
	}
	summary := f.env.Get("/admin/summary", f.admin).Expect(t, http.StatusOK).Map(t)
	if summary["dataSourcesFailed"] != 1.0 {
		t.Fatal(summary)
	}
	path := versionPath(sources.KindGBIFArchive, v["id"].(string))
	not := f.env.Post(path+"/activate", nil, f.admin).Expect(t, http.StatusConflict).Map(t)
	if not["code"] != "not_ready" {
		t.Fatal(not)
	}
	f.m.UseProcessor(sources.KindGBIFArchive, acceptAll{})
	queued := f.env.Post(path+"/reprocess", nil, f.admin).Expect(t, http.StatusAccepted).Map(t)
	if queued["state"] != "validating" {
		t.Fatal(queued)
	}
	f.m.Wait()
	done := f.version(sources.KindGBIFArchive, v["id"].(string))
	if done["state"] != "ready" || done["error"] != nil || done["metadata"].(map[string]any)["checked"] != true {
		t.Fatal(done)
	}
}

func TestStartResumesInterruptedProcessing(t *testing.T) {
	f := newFixture(t)
	data := gridFixture(t, f)
	v := f.upload(sources.KindTreesGrid, "g.parquet", data, map[string]any{"activate": false})
	f.exec("UPDATE data_source_version SET state = 'processing' WHERE id = ?", db.MustID(v["id"].(string)))
	m := sources.Restarted(f.m)
	m.UseTreesGridRows(1, 100)
	ctx, stop := context.WithCancel(t.Context())
	defer stop()
	if err := m.Start(ctx); err != nil {
		t.Fatal(err)
	}
	m.Wait()
	if state, active := f.state(v["id"].(string)); state != "ready" || active {
		t.Fatal(state, active)
	}
}

func steinpilz(f *fixture) db.ID {
	return scalar[db.ID](f, "SELECT id FROM species WHERE slug = 'steinpilz'")
}

// bundleZip packs the test bundle of package bundle under the folder.
func bundleZip(t *testing.T, folder string) []byte {
	t.Helper()
	dir := filepath.Join("..", "..", "pipeline", "model", "bundle", "testdata", "bundle_v1")
	files := map[string][]byte{}
	for _, name := range []string{"bundle.json", "h0.txt", "h2.txt"} {
		data, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			t.Fatal(err)
		}
		files[filepath.ToSlash(filepath.Join(folder, name))] = data
	}
	return sources.ZipOf(t, files)
}

func TestModelBundleArchiveMakesOneVersionPerSpecies(t *testing.T) {
	f := newFixture(t)
	set := f.upload(sources.KindModelBundle, "models.zip", bundleZip(t, "steinpilz"), nil)
	if set["state"] != "ready" || set["active"] != true || set["speciesId"] != nil {
		t.Fatal(set)
	}
	species := steinpilz(f)
	model, err := f.m.Resolver().Active(sources.KindModelBundle, species.String())
	if err != nil {
		t.Fatal(err)
	}
	if model.Origin != sources.OriginDerived || model.DerivedFromID == nil || model.DerivedFromID.String() != set["id"] {
		t.Fatal(model)
	}
	bundleDir, ok := model.Artifact("bundle")
	if !ok || bundleDir.Path != f.m.Abs("models/steinpilz/v1") {
		t.Fatal(model.Artifacts)
	}
	if _, err := os.Stat(filepath.Join(bundleDir.Path, "bundle.json")); err != nil {
		t.Fatal(err)
	}
	detail := f.env.Get("/data-sources/model-bundle?speciesId="+species.String(), f.admin).Expect(t, http.StatusOK).Map(t)
	if len(detail["versions"].([]any)) != 1 || detail["state"] != "ready" {
		t.Fatal(detail)
	}
	again := f.upload(sources.KindModelBundle, "models.zip", bundleZip(t, "steinpilz"), nil)
	if again["state"] != "ready" {
		t.Fatal(again)
	}
	newer, err := f.m.Resolver().Active(sources.KindModelBundle, species.String())
	if err != nil || newer.Number != 2 || newer.Dir != f.m.Abs("models/steinpilz/v2") {
		t.Fatal(newer, err)
	}
}

func TestModelBundleForOneSpecies(t *testing.T) {
	f := newFixture(t)
	species := steinpilz(f)
	v := f.upload(sources.KindModelBundle, "steinpilz.zip", bundleZip(t, "."), map[string]any{"speciesId": species.String()})
	if v["state"] != "ready" || v["speciesId"] != species.String() || v["active"] != true {
		t.Fatal(v)
	}
	other := scalar[db.ID](f, "SELECT id FROM species WHERE slug = 'parasol'")
	wrong := f.upload(sources.KindModelBundle, "x.zip", bundleZip(t, "steinpilz"), map[string]any{"speciesId": other.String()})
	if wrong["state"] != "failed" || wrong["error"].(map[string]any)["code"] != "species_mismatch" {
		t.Fatal(wrong)
	}
	unknown := f.upload(sources.KindModelBundle, "x.zip", bundleZip(t, "no-such-species"), nil)
	if unknown["state"] != "failed" {
		t.Fatal(unknown)
	}
	broken := f.upload(sources.KindModelBundle, "x.zip", sources.ZipOf(t, map[string][]byte{"steinpilz/bundle.json": []byte("{}")}), nil)
	if broken["state"] != "failed" || broken["error"].(map[string]any)["code"] != "model" {
		t.Fatal(broken)
	}
}

func TestForecastChainsAreSeeded(t *testing.T) {
	f := newFixture(t)
	if n := scalar[int](f, "SELECT count(*) FROM species_forecast"); n != len(sources.Chains) {
		t.Fatal(n)
	}
	slug := scalar[string](f, `SELECT s.slug FROM species_forecast f JOIN species s ON s.id = f.species_id
		WHERE f.chain_key = 'reizker'`)
	if slug != "edelreizker" {
		t.Fatal(slug)
	}
	if forest := scalar[float64](f, "SELECT min_forest FROM species_forecast WHERE chain_key = 'schopftintling'"); forest != 0 {
		t.Fatal(forest)
	}
}

package runner_test

import (
	"context"
	"log/slog"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/render"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/runner"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
)

func writeText(t *testing.T, path, text string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(text), 0o644); err != nil {
		t.Fatal(err)
	}
}

func readText(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

// installFolder installs a folder as the active version of a kind. The files map
// relative paths to their text. layers names the folder that holds layers.json, or "".
func (f *fixture) installFolder(kind sources.Kind, files map[string]string, layers string) sources.Version {
	f.t.Helper()
	dir := filepath.Join(f.data, "staging-"+db.NewID().String())
	for rel, text := range files {
		writeText(f.t, filepath.Join(dir, filepath.FromSlash(rel)), text)
	}
	v, err := f.sources.Install(context.Background(), sources.Install{
		Kind: kind, Origin: sources.OriginUpload, From: dir, Artifact: "folder", Activate: true,
	})
	if err != nil {
		f.t.Fatal(err)
	}
	if layers != "" {
		rel, err := filepath.Rel(f.data, filepath.Join(v.Dir, filepath.FromSlash(layers), render.LayersFile))
		if err != nil {
			f.t.Fatal(err)
		}
		f.exec("INSERT INTO data_source_artifact (version_id, name, path, size_bytes) VALUES (?, ?, ?, 0)",
			v.ID, render.LayersFile, filepath.ToSlash(rel))
	}
	return v
}

func staticManifest(names ...string) string {
	entries := make([]string, len(names))
	for i, n := range names {
		entries[i] = `"` + n + `": {"label": "` + n + `", "static": true, "tiles": "layers_kacheln/` + n + `"}`
	}
	return `{"layers": {` + strings.Join(entries, ", ") + `}}`
}

func TestPublishStaticCopiesTheActiveLayersOnce(t *testing.T) {
	f := newFixture(t, 1)
	out := t.TempDir()
	chain := &runner.Chain{DB: f.env.DB, Sources: f.sources, Data: f.data, Maps: out}
	f.installFolder(sources.KindStaticLayers, map[string]string{
		"derived/layers.json":                     staticManifest("hoehe", "relief"),
		"derived/layers_kacheln/hoehe/5/1/1.png":  "upload",
		"derived/layers_kacheln/relief/5/1/1.png": "relief",
	}, "derived")
	f.installFolder(sources.KindDEM, map[string]string{
		"derived/layers.json":                          staticManifest("hoehe", "hangneigung"),
		"derived/layers_kacheln/hoehe/6/2/2.png":       "dem",
		"derived/layers_kacheln/hangneigung/5/1/1.png": "slope",
	}, "derived")
	f.installFolder(sources.KindTreeSpeciesMap, map[string]string{"derived/trees.parquet": "x"}, "")
	var lines []string
	logf := func(format string, args ...any) { lines = append(lines, format) }
	if err := chain.PublishStatic(logf); err != nil {
		t.Fatal(err)
	}
	manifest := readText(t, filepath.Join(out, render.LayersFile))
	if !strings.Contains(manifest, `"hoehe"`) || !strings.Contains(manifest, `"relief"`) || !strings.Contains(manifest, `"hangneigung"`) {
		t.Fatalf("layers.json = %s", manifest)
	}
	if readText(t, filepath.Join(out, "layers_kacheln/hoehe/6/2/2.png")) != "dem" {
		t.Fatal("the dem must win the layer hoehe over the upload")
	}
	stamp := filepath.Join(out, "layers_kacheln/relief/5/1/1.png")
	writeText(t, stamp, "published")
	if err := chain.PublishStatic(logf); err != nil {
		t.Fatal(err)
	}
	if readText(t, stamp) != "published" || readText(t, filepath.Join(out, render.LayersFile)) != manifest {
		t.Fatal("a second publication of the same versions must copy nothing")
	}
	if err := os.Remove(filepath.Join(out, render.LayersFile)); err != nil {
		t.Fatal(err)
	}
	chain.Activated(context.Background(), sources.KindTreesGrid, slog.Default())
	if _, err := os.Stat(filepath.Join(out, render.LayersFile)); !os.IsNotExist(err) {
		t.Fatal("the activation of a kind without static layers must publish nothing")
	}
	chain.Activated(context.Background(), sources.KindDEM, slog.Default())
	if readText(t, filepath.Join(out, render.LayersFile)) != manifest {
		t.Fatal("the activation of a dem must publish the static layers")
	}
}

// recorder is a Renderer that records what each call gets.
type recorder struct {
	mu      sync.Mutex
	maps    string
	species []runner.SpeciesRender
	layers  []runner.LayersRender
	// manifest is layers.json at the start of the layer call.
	manifest string
}

func (r *recorder) RenderSpecies(_ context.Context, in runner.SpeciesRender) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.species = append(r.species, in)
	return nil
}

func (r *recorder) RenderLayers(_ context.Context, in runner.LayersRender) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.layers = append(r.layers, in)
	data, _ := os.ReadFile(filepath.Join(r.maps, render.LayersFile))
	r.manifest = string(data)
	return nil
}

// renderChain is the real chain without the weather, occurrence and season work.
type renderChain struct{ *runner.Chain }

func (renderChain) Weather(context.Context, *runner.Job) error     { return nil }
func (renderChain) Occurrences(context.Context, *runner.Job) error { return nil }
func (renderChain) Season(context.Context, *runner.Job) error      { return nil }

// writeTable writes the columns as a parquet file at path.
func writeTable(t *testing.T, path string, n int, strs map[string][]string, floats map[string][]float32) {
	t.Helper()
	tab := pio.NewTable(n)
	var schema []pio.ColumnSpec
	for _, name := range slices.Sorted(maps.Keys(strs)) {
		tab.Str[name] = strs[name]
		schema = append(schema, pio.ColumnSpec{Name: name, Type: pio.String})
	}
	for _, name := range slices.Sorted(maps.Keys(floats)) {
		tab.F32[name] = floats[name]
		schema = append(schema, pio.ColumnSpec{Name: name, Type: pio.Float32})
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := pio.WriteParquet(path, tab, schema); err != nil {
		t.Fatal(err)
	}
}

// writeWeekly writes each checkpoint of the extraction for two cells and three weeks.
func writeWeekly(t *testing.T, dir string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, job := range weather.Jobs {
		var rows struct {
			years, weeks []int64
			cells        []string
			vals         []float32
		}
		for w := int64(1); w <= 3; w++ {
			for _, cell := range []string{"820_600", "821_600"} {
				rows.years, rows.weeks = append(rows.years, 2026), append(rows.weeks, w)
				rows.cells, rows.vals = append(rows.cells, cell), append(rows.vals, float32(w))
			}
		}
		tab := pio.NewTable(len(rows.vals))
		tab.I64["iso_year"], tab.I64["iso_week"], tab.Str["cell"], tab.F32[job.Name] = rows.years, rows.weeks, rows.cells, rows.vals
		schema := []pio.ColumnSpec{{Name: "iso_year", Type: pio.Int16}, {Name: "iso_week", Type: pio.Int8},
			{Name: "cell", Type: pio.String}, {Name: job.Name, Type: pio.Float32}}
		if err := pio.WriteParquet(weather.CheckpointPath(dir, job.Name), tab, schema); err != nil {
			t.Fatal(err)
		}
	}
}

// installBundle installs the test bundle of package bundle for a species, with
// renamed features so that the model reads the weather.
func (f *fixture) installBundle(species db.ID, renames map[string]string) {
	f.t.Helper()
	src := "../model/bundle/testdata/bundle_v1"
	dir := filepath.Join(f.data, "staging-"+db.NewID().String())
	for _, name := range []string{"bundle.json", "h0.txt", "h2.txt"} {
		text := readText(f.t, filepath.Join(src, name))
		for from, to := range renames {
			text = strings.ReplaceAll(text, from, to)
		}
		writeText(f.t, filepath.Join(dir, name), text)
	}
	if _, err := f.sources.Install(context.Background(), sources.Install{Kind: sources.KindModelBundle,
		SpeciesID: &species, Origin: sources.OriginUpload, From: dir, Artifact: "bundle", Activate: true}); err != nil {
		f.t.Fatal(err)
	}
}

func (f *fixture) installFile(kind sources.Kind, artifact string, write func(path string)) {
	f.t.Helper()
	path := filepath.Join(f.data, "staging-"+db.NewID().String(), artifact+".parquet")
	write(path)
	if _, err := f.sources.Install(context.Background(), sources.Install{
		Kind: kind, Origin: sources.OriginUpload, From: path, Artifact: artifact, Activate: true,
	}); err != nil {
		f.t.Fatal(err)
	}
}

func TestARenderRunReadsTheInputsOnceAndPublishesTheStaticLayersFirst(t *testing.T) {
	f := newFixture(t, 2)
	writeWeekly(t, filepath.Join(f.data, "interim", "weekly"))
	cells := []string{"820_600", "821_600"}
	f.installFile(sources.KindTreesGrid, "trees_de_500m", func(p string) {
		writeTable(t, p, 2, nil, map[string][]float32{"x": {4100250, 4105250}, "y": {3000250, 3000250}, "forest_fraction": {0.5, 0.7}})
	})
	f.installFile(sources.KindTreeScales, "tree_scales", func(p string) {
		writeTable(t, p, 2, map[string][]string{"cell": cells}, map[string][]float32{"f_normal": {1, 2}, "other": {3, 4}})
	})
	f.installFile(sources.KindSiteGrid, "site_500m", func(p string) {
		writeTable(t, p, 2, map[string][]string{"cell": cells}, map[string][]float32{"soil_phh2o_0_5cm": {5, 6}})
	})
	ids, err := db.Column[db.ID](context.Background(), f.env.DB,
		"SELECT id FROM species WHERE forecast_enabled = 1 ORDER BY name, id")
	if err != nil || len(ids) != 2 {
		t.Fatal(ids, err)
	}
	f.installBundle(ids[0], map[string]string{"f_noise": "pr_lag1"})
	f.installBundle(ids[1], map[string]string{"f_gappy": "tas_lag1"})
	f.installFolder(sources.KindStaticLayers, map[string]string{
		"derived/layers.json":                    staticManifest("hoehe"),
		"derived/layers_kacheln/hoehe/5/1/1.png": "upload",
	}, "derived")

	out := t.TempDir()
	rec := &recorder{maps: out}
	chain := &runner.Chain{DB: f.env.DB, Sources: f.sources, Data: f.data, Maps: out, Renderer: rec}
	f.runner = runner.New(runner.Config{DB: f.env.DB, Runs: f.runs, Sources: f.sources,
		Stages: renderChain{Chain: chain}, Logs: f.env.Settings.RunLogs})
	run := f.queue(enums.RunKindRender)
	f.runNext()
	if got := f.get(run.ID); got.State != enums.RunStateFinished {
		t.Fatalf("run = %s\n%s", got.State, f.logOf(run.ID))
	}

	if len(rec.species) != 2 || len(rec.layers) != 1 {
		t.Fatalf("%d species calls, %d layer calls", len(rec.species), len(rec.layers))
	}
	a, b := rec.species[0], rec.species[1]
	if a.Tables.Trees != b.Tables.Trees || a.Tables.Scales != b.Tables.Scales || a.Tables.Site != b.Tables.Site || a.Cube != b.Cube {
		t.Fatal("the species of a run must share the tables and the weather")
	}
	if _, ok := a.Tables.Scales.F32["other"]; ok || a.Tables.Scales.F32["f_normal"] == nil {
		t.Fatal("the scales must hold the columns of the models only")
	}
	if got := slices.Sorted(maps.Keys(a.Cube.Vars)); !slices.Equal(got, []string{"pr", "tas"}) {
		t.Fatalf("the maps read the checkpoints %v", got)
	}
	if a.SharedHorizon != 2 || len(a.Cube.Cells) != 2 || len(a.Cube.Weeks) != 3 {
		t.Fatalf("shared horizon %d, cube %d cells, %d weeks", a.SharedHorizon, len(a.Cube.Cells), len(a.Cube.Weeks))
	}
	l := rec.layers[0]
	if l.Tables.Trees != a.Tables.Trees || l.Tables.Scales != nil || len(l.Cube.Vars) != len(render.LayerWeather()) {
		t.Fatal("the layers must share the grids, get no scales and read their own checkpoints")
	}
	if !strings.Contains(rec.manifest, `"hoehe"`) {
		t.Fatalf("the static layers must be in layers.json before the layer step: %q", rec.manifest)
	}
	if readText(t, filepath.Join(out, "layers_kacheln/hoehe/5/1/1.png")) != "upload" {
		t.Fatal("the tiles of the static layer are missing")
	}
}

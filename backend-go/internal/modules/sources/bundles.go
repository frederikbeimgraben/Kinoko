package sources

import (
	"context"
	"database/sql"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/bundle"
)

// modelBundles checks a zip of species models: <slug>/bundle.json with
// <slug>/h<k>.txt, or bundle.json at the top for an upload of one species.
// LightGBM loads each model, so a model that the renderer cannot use fails here.
type modelBundles struct{ handle *sql.DB }

// bundleInfo is the report of one species model in the archive.
type bundleInfo struct {
	Folder    string `json:"folder"`
	Slug      string `json:"slug"`
	SpeciesID db.ID  `json:"speciesId"`
	Label     string `json:"label"`
	Horizons  []int  `json:"horizons"`
}

// bundleFolders groups the archive entries by the folder that holds a bundle.json.
func bundleFolders(names []string) map[string][]string {
	folders := fn.Set(fn.FlatMap(names, func(n string) []string {
		if path.Base(n) != bundle.FileName || strings.Count(n, "/") > 1 {
			return nil
		}
		return []string{path.Dir(n)}
	}))
	return fn.Reduce(names, map[string][]string{}, func(acc map[string][]string, n string) map[string][]string {
		if _, ok := folders[path.Dir(n)]; ok {
			acc[path.Dir(n)] = append(acc[path.Dir(n)], n)
		}
		return acc
	})
}

func bundleDir(v *Version, folder string) string {
	if folder == "." {
		folder = "bundle"
	}
	return filepath.Join(v.DerivedDir(), folder)
}

// speciesOf finds the catalogue species of a bundle: by the folder as
// slug, by the chain key, by a scientific name, then by the bundle slug.
func (p modelBundles) speciesOf(ctx context.Context, folder string, b *bundle.Bundle) (db.ID, string, bool, error) {
	type hit struct {
		id   db.ID
		slug string
	}
	scan := func(s db.Scanner) (hit, error) {
		var h hit
		return h, s.Scan(&h.id, &h.slug)
	}
	queries := []struct {
		sql  string
		args []any
	}{
		{"SELECT id, slug FROM species WHERE slug = ?", []any{folder}},
		{"SELECT s.id, s.slug FROM species s JOIN species_forecast f ON f.species_id = s.id WHERE f.chain_key = ?", []any{folder}},
		{"SELECT id, slug FROM species WHERE lower(latin_name) IN (" + db.Placeholders(len(b.Species)) + ") LIMIT 1",
			fn.Map(b.Species, func(n string) any { return strings.ToLower(n) })},
		{"SELECT id, slug FROM species WHERE slug = ?", []any{b.Slug}},
	}
	for _, q := range queries {
		if len(q.args) == 0 {
			continue
		}
		found, ok, err := db.Maybe(ctx, p.handle, scan, q.sql, q.args...)
		if err != nil || ok {
			return found.id, found.slug, ok, err
		}
	}
	return db.ID{}, "", false, nil
}

func (p modelBundles) Validate(ctx context.Context, v *Version) (map[string]any, error) {
	z, err := openZip(v.Original())
	if err != nil {
		return nil, err
	}
	defer z.Close()
	entries, err := zipFiles(z)
	if err != nil {
		return nil, err
	}
	folders := bundleFolders(fn.SortedKeys(entries))
	if len(folders) == 0 {
		return nil, Fail("no_bundle", "the archive has no %s", bundle.FileName)
	}
	if v.SpeciesID != nil && len(folders) != 1 {
		return nil, Fail("species_mismatch", "an upload for one species must hold one bundle, not %d", len(folders))
	}
	if err := os.RemoveAll(v.DerivedDir()); err != nil {
		return nil, err
	}
	infos, err := fn.MapErr(fn.SortedKeys(folders), func(folder string) (bundleInfo, error) {
		return p.check(ctx, v, folder, fn.Map(folders[folder], func(n string) func(string) error {
			return func(target string) error { return extract(entries[n], filepath.Join(target, path.Base(n))) }
		}))
	})
	if err != nil {
		return nil, err
	}
	return map[string]any{"bundles": infos}, nil
}

// check unpacks one bundle, loads it and finds its species.
func (p modelBundles) check(ctx context.Context, v *Version, folder string, unpack []func(string) error) (bundleInfo, error) {
	dir := bundleDir(v, folder)
	for _, write := range unpack {
		if err := write(dir); err != nil {
			return bundleInfo{}, err
		}
	}
	b, err := bundle.Load(dir)
	if err != nil {
		return bundleInfo{}, Fail("model", "%s: %v", folder, err)
	}
	defer b.Close()
	id, slug, found, err := p.speciesOf(ctx, folder, b)
	if err != nil {
		return bundleInfo{}, err
	}
	switch {
	case v.SpeciesID != nil && found && id != *v.SpeciesID:
		return bundleInfo{}, Fail("species_mismatch", "the bundle %s is for the species %s", folder, slug)
	case v.SpeciesID != nil:
		id = *v.SpeciesID
	case !found:
		return bundleInfo{}, Fail("unknown_species", "the catalogue has no species for the bundle %s", folder)
	}
	v.Logf("%s: species %s, horizons %v", folder, slug, b.HorizonKeys())
	return bundleInfo{Folder: folder, Slug: slug, SpeciesID: id, Label: b.Label, Horizons: b.HorizonKeys()}, nil
}

// Derive gives the bundle of a one-species upload as its artifact. For an
// archive of many species, each bundle becomes a version of its species.
func (modelBundles) Derive(_ context.Context, v *Version) ([]Artifact, error) {
	infos, ok := v.Metadata["bundles"].([]bundleInfo)
	if !ok {
		return nil, Fail("derive_failed", "the validation report has no bundles")
	}
	return fn.MapErr(infos, func(info bundleInfo) (Artifact, error) {
		dir := bundleDir(v, info.Folder)
		size, err := treeSize(dir)
		if err != nil {
			return Artifact{}, err
		}
		if v.SpeciesID != nil {
			return Artifact{Name: "bundle", Path: dir, SizeBytes: size}, nil
		}
		return Artifact{Name: "model:" + info.Slug, Path: dir, SizeBytes: size,
			Spawn: &Spawn{Kind: KindModelBundle, SpeciesID: info.SpeciesID}}, nil
	})
}

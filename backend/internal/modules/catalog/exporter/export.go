package exporter

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

// Report counts the written files and lists the data that the seed format cannot hold.
type Report struct {
	Species   int
	Removed   int
	Reactions int
	Glossary  int
	Warnings  []string
}

// Lines gives the lines of the CLI report.
func (r Report) Lines() []string {
	lines := []string{
		fmt.Sprintf("species profiles: %d", r.Species),
		fmt.Sprintf("removed profiles: %d", r.Removed),
		fmt.Sprintf("reactions: %d", r.Reactions),
		fmt.Sprintf("glossary entries: %d", r.Glossary),
	}
	for _, w := range r.Warnings {
		lines = append(lines, "warning: "+w)
	}
	return lines
}

// Run is the command "kinoko export-catalog". It reads the source files from base, writes the
// catalogue of the database into out and writes the report to w.
func Run(ctx context.Context, handle *sql.DB, base fs.FS, out string, w io.Writer) error {
	report, err := Export(ctx, handle, base, out)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintln(w, strings.Join(report.Lines(), "\n"))
	return err
}

// Export writes the species profiles, daten/reaktionen.json and daten/glossar.json into out.
// The keys that the database does not hold keep their values from the files in base.
func Export(ctx context.Context, handle *sql.DB, base fs.FS, out string) (Report, error) {
	report := Report{}
	sources, err := readSources(base)
	if err != nil {
		return report, err
	}
	profiles, err := importer.LoadProfiles(base)
	if err != nil {
		return report, err
	}
	stored, err := loadCatalogue(ctx, handle)
	if err != nil {
		return report, err
	}
	// An export of an empty database removes each profile of the seed.
	if len(stored.Species) == 0 {
		return report, errors.New("the database has no species; start the service or run import-catalog first")
	}
	files, err := speciesFiles(stored, sources, profiles, &report)
	if err != nil {
		return report, err
	}
	if err := writeProfiles(out, files, &report); err != nil {
		return report, err
	}
	reactions, err := exportReactions(ctx, handle, base, profiles, stored, &report)
	if err != nil {
		return report, err
	}
	glossary, err := exportGlossary(ctx, handle, base, &report)
	if err != nil {
		return report, err
	}
	if err := os.WriteFile(filepath.Join(out, importer.ReactionsFile), reactions, 0o644); err != nil {
		return report, err
	}
	return report, os.WriteFile(filepath.Join(out, glossaryFile), glossary, 0o644)
}

func readSources(base fs.FS) (map[string]File, error) {
	names, err := fs.Glob(base, "arten/*.toml")
	if err != nil {
		return nil, err
	}
	out := map[string]File{}
	for _, name := range names {
		body, err := fs.ReadFile(base, name)
		if err != nil {
			return nil, err
		}
		parsed, err := ParseFile(string(body), name)
		if err != nil {
			return nil, err
		}
		out[strings.TrimSuffix(path.Base(name), ".toml")] = parsed
	}
	return out, nil
}

// stemsOf gives the file stem of each species: the stem of the source file with the same latin
// name, else with the same name, else a new stem from the name.
func stemsOf(species []*stored, sources map[string]File) map[string]db.ID {
	ids := map[string]db.ID{}
	bySlug, byName := map[string]string{}, map[string]string{}
	for _, stem := range sortedStems(sources) {
		bySlug[importer.Slugify(sources[stem].Lateinisch)] = stem
		byName[sources[stem].Name] = stem
	}
	var rest []*stored
	for _, s := range species {
		if stem, ok := bySlug[s.Row.Slug]; ok {
			ids[stem] = s.Row.ID
		} else {
			rest = append(rest, s)
		}
	}
	for _, s := range rest {
		stem, ok := byName[s.Row.Name]
		if _, taken := ids[stem]; !ok || taken {
			stem = importer.Slugify(s.Row.Name)
			for n := 2; ; n++ {
				if _, taken := ids[stem]; !taken {
					break
				}
				stem = fmt.Sprintf("%s-%d", importer.Slugify(s.Row.Name), n)
			}
		}
		ids[stem] = s.Row.ID
	}
	return ids
}

func speciesFiles(c catalogue, sources map[string]File, profiles []importer.StemProfile, report *Report) (map[string][]byte, error) {
	species := c.Species
	ids := stemsOf(species, sources)
	byID := map[db.ID]*stored{}
	for _, s := range species {
		byID[s.Row.ID] = s
	}
	colours := importer.ColourVocabulary(profiles)
	for _, s := range species {
		for _, list := range s.Colours {
			for _, c := range list {
				if _, known := colours[c.Name]; !known {
					colours[c.Name] = c.Hex
				}
			}
		}
	}
	pairs := lookalikes(c.Lookalikes, ids, sources, report)
	files := map[string][]byte{}
	for _, stem := range sortedStems(ids) {
		job := speciesExport{stem: stem, base: sources[stem], db: byID[ids[stem]], report: report, vocabulary: colours}
		profile := job.build()
		profile.Verwechslungen = pairs[stem]
		body := Format(profile)
		if _, err := importer.ParseProfile(string(body), stem); err != nil {
			return nil, err
		}
		files[stem] = body
	}
	return files, nil
}

func writeProfiles(out string, files map[string][]byte, report *Report) error {
	dir := filepath.Join(out, "arten")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	old, err := filepath.Glob(filepath.Join(dir, "*.toml"))
	if err != nil {
		return err
	}
	for _, name := range old {
		if _, kept := files[strings.TrimSuffix(filepath.Base(name), ".toml")]; !kept {
			if err := os.Remove(name); err != nil {
				return err
			}
			report.Removed++
		}
	}
	for stem, body := range files {
		if err := os.WriteFile(filepath.Join(dir, stem+".toml"), body, 0o644); err != nil {
			return err
		}
		report.Species++
	}
	return nil
}

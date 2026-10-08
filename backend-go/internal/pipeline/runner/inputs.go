package runner

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather/dwd"
)

// ErrInputsMissing tells that a run kind needs a data source without an active, ready version.
var ErrInputsMissing = errors.New("inputs_missing")

// reads lists the uploaded kinds that each run kind reads, when they are active.
// The model of each species comes on top for a render run.
var reads = map[enums.RunKind][]sources.Kind{
	enums.RunKindTraining: {sources.KindTreeScales, sources.KindWeatherCheckpoints, sources.KindGBIFArchive},
	enums.RunKindRender: {sources.KindTreesGrid, sources.KindTreeScales, sources.KindSiteGrid,
		sources.KindWeatherCheckpoints, sources.KindGBIFArchive, sources.KindStaticLayers},
	enums.RunKindFull: {sources.KindTreesGrid, sources.KindTreeScales, sources.KindSiteGrid,
		sources.KindWeatherCheckpoints, sources.KindGBIFArchive, sources.KindStaticLayers},
}

// remoteReads are the public sources that the chain reads from the cache.
var remoteReads = []string{dwd.SourceHyras, dwd.SourceSoil, SourceOccurrences}

// Input is one row of pipeline_run_input. Snapshot is the JSON state of a public source.
type Input struct {
	Kind      string
	VersionID *db.ID
	Snapshot  *string
}

// missingError makes the inputs_missing error of the kinds.
func missingError(kinds []sources.Kind) error {
	names := fn.Map(kinds, func(k sources.Kind) string { return string(k) })
	return fmt.Errorf("%w: %s", ErrInputsMissing, strings.Join(names, ", "))
}

// checkInputs refuses a run whose kind needs a data source that has no active, ready version.
func (r *Runner) checkInputs(ctx context.Context, kind enums.RunKind) error {
	missing, err := r.sources.Missing(ctx, kind)
	if err != nil {
		return err
	}
	if len(missing) > 0 {
		return missingError(missing)
	}
	return nil
}

// inputsOf collects the active versions and the cache state that a run reads.
func (r *Runner) inputsOf(ctx context.Context, kind enums.RunKind, species []Species) ([]Input, error) {
	if kind == enums.RunKindFetch {
		return nil, nil
	}
	resolve := r.sources.Resolver()
	versionInput := func(name string, kind sources.Kind, speciesID string) ([]Input, error) {
		v, err := resolve.Active(kind, speciesID)
		if errors.Is(err, sources.ErrMissing) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		return []Input{{Kind: name, VersionID: &v.ID}}, nil
	}
	uploaded, err := fn.MapErr(reads[kind], func(k sources.Kind) ([]Input, error) {
		return versionInput(string(k), k, "")
	})
	if err != nil {
		return nil, err
	}
	var models [][]Input
	if kind == enums.RunKindRender {
		models, err = fn.MapErr(species, func(sp Species) ([]Input, error) {
			return versionInput(string(sources.KindModelBundle)+":"+sp.Slug, sources.KindModelBundle, sp.ID.String())
		})
		if err != nil {
			return nil, err
		}
	}
	remote, err := fn.MapErr(remoteReads, func(source string) (Input, error) {
		return r.snapshot(ctx, source)
	})
	if err != nil {
		return nil, err
	}
	flat := func(rows []Input) []Input { return rows }
	return append(append(fn.FlatMap(uploaded, flat), fn.FlatMap(models, flat)...), remote...), nil
}

// snapshot gives the cache state of a public source: the count of good files and the newest fetch.
func (r *Runner) snapshot(ctx context.Context, source string) (Input, error) {
	type state struct {
		Files  int     `json:"files"`
		Newest *string `json:"newestFetchedAt"`
	}
	s, err := db.One(ctx, r.db, func(sc db.Scanner) (state, error) {
		var s state
		return s, sc.Scan(&s.Files, &s.Newest)
	}, `SELECT count(*), max(fetched_at) FROM remote_cache_file WHERE source = ? AND state = ?`, source, dwd.StateOK)
	if err != nil {
		return Input{}, err
	}
	encoded, err := json.Marshal(s)
	if err != nil {
		return Input{}, err
	}
	return Input{Kind: source, Snapshot: fn.Ptr(string(encoded))}, nil
}

// writeInputs stores the provenance of a run.
func (r *Runner) writeInputs(ctx context.Context, run db.ID, inputs []Input) error {
	return db.InTx(ctx, r.db, func(tx *sql.Tx) error {
		for _, in := range inputs {
			if _, err := tx.ExecContext(ctx, `INSERT OR REPLACE INTO pipeline_run_input
				(run_id, kind, version_id, remote_snapshot) VALUES (?, ?, ?, ?)`,
				run, in.Kind, in.VersionID, in.Snapshot); err != nil {
				return err
			}
		}
		return nil
	})
}

// speciesOf reads the species rows of a run with their forecast chain, by name.
func (r *Runner) speciesOf(ctx context.Context, run db.ID) ([]Species, error) {
	return db.All(ctx, r.db, func(s db.Scanner) (Species, error) {
		var sp Species
		var key, taxa *string
		var minForest *float64
		if err := s.Scan(&sp.ID, &sp.Slug, &sp.Name, &sp.Latin, &key, &taxa, &minForest); err != nil {
			return sp, err
		}
		if key == nil || taxa == nil {
			return sp, nil
		}
		chain := sources.Chain{Key: *key, MinForest: fn.Deref(minForest, 0)}
		if err := json.Unmarshal([]byte(*taxa), &chain.Taxa); err != nil {
			return sp, fmt.Errorf("runner: taxa of %s: %w", sp.Slug, err)
		}
		sp.Chain = &chain
		return sp, nil
	}, `SELECT s.id, s.slug, s.name, s.latin_name, f.chain_key, f.taxa, f.min_forest
		FROM pipeline_run_species prs JOIN species s ON s.id = prs.species_id
		LEFT JOIN species_forecast f ON f.species_id = s.id
		WHERE prs.run_id = ? ORDER BY s.name, s.id`, run)
}

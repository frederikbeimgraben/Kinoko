package sources

import (
	"context"
	"errors"
	"fmt"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// ErrMissing tells that a kind has no active, ready version.
var ErrMissing = errors.New("sources: no active version")

// Resolver finds the active inputs of the pipeline.
// Active gives the active version of a kind; speciesID is "" for a kind
// without species. Path gives the absolute path of an artifact of the
// active version; the name "original" gives the uploaded file.
type Resolver interface {
	Active(kind Kind, speciesID string) (*Version, error)
	Path(kind Kind, artifact string) (string, error)
}

// Resolver gives the resolver of the module.
func (m *Module) Resolver() Resolver { return resolver{m: m} }

type resolver struct{ m *Module }

func (r resolver) Active(kind Kind, speciesID string) (*Version, error) {
	return r.m.active(context.Background(), kind, speciesID)
}

func (r resolver) Path(kind Kind, artifact string) (string, error) {
	v, err := r.m.active(context.Background(), kind, "")
	if err != nil {
		return "", err
	}
	if a, ok := v.Artifact(artifact); ok {
		return a.Path, nil
	}
	if original := v.Original(); artifact == originalName && original != "" {
		return original, nil
	}
	return "", fmt.Errorf("%w: %s version %d has no artifact %q", ErrMissing, kind, v.Number, artifact)
}

func (m *Module) active(ctx context.Context, kind Kind, speciesID string) (*Version, error) {
	var species *db.ID
	if speciesID != "" {
		id, err := db.ParseID(speciesID)
		if err != nil {
			return nil, fmt.Errorf("sources: species %q: %w", speciesID, err)
		}
		species = &id
	}
	found, err := m.files.versions(ctx, m.deps.DB, "WHERE "+sameGroup+" AND active = 1 AND state = ?",
		kind, speciesKey(species), StateReady)
	if err != nil {
		return nil, err
	}
	if len(found) == 0 {
		return nil, fmt.Errorf("%w: %s", ErrMissing, kind)
	}
	return &found[0], nil
}

// needs lists the kinds that each run kind reads. A model is necessary for
// at least one species.
var needs = map[enums.RunKind][]Kind{
	enums.RunKindTraining: {KindTreeScales},
	enums.RunKindRender:   {KindTreesGrid, KindTreeScales, KindSiteGrid, KindModelBundle},
	enums.RunKindFull:     {KindTreesGrid, KindTreeScales, KindSiteGrid},
	enums.RunKindFetch:    {},
}

// Missing gives the kinds that a run of the kind needs and that have no
// active, ready version. The runner refuses the run with inputs_missing.
func (m *Module) Missing(ctx context.Context, kind enums.RunKind) ([]Kind, error) {
	ready, err := db.Column[Kind](ctx, m.deps.DB,
		"SELECT DISTINCT kind FROM data_source_version WHERE active = 1 AND state = ?", StateReady)
	if err != nil {
		return nil, err
	}
	have := fn.Set(ready)
	return fn.Filter(needs[kind], func(k Kind) bool {
		_, ok := have[k]
		return !ok
	}), nil
}

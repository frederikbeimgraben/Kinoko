package sources

import (
	"context"
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/paging"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

type artifactView struct {
	Name      string `json:"name"`
	SizeBytes int64  `json:"sizeBytes"`
}

type errorView struct {
	Code   string  `json:"code"`
	Detail *string `json:"detail"`
}

// versionView is the JSON form of a version.
type versionView struct {
	ID            db.ID          `json:"id"`
	Kind          Kind           `json:"kind"`
	Version       int            `json:"version"`
	Origin        Origin         `json:"origin"`
	DerivedFromID *db.ID         `json:"derivedFromId"`
	SpeciesID     *db.ID         `json:"speciesId"`
	State         VersionState   `json:"state"`
	Active        bool           `json:"active"`
	FileName      *string        `json:"fileName"`
	SizeBytes     *int64         `json:"sizeBytes"`
	SHA256        *string        `json:"sha256"`
	Metadata      map[string]any `json:"metadata"`
	Artifacts     []artifactView `json:"artifacts"`
	Error         *errorView     `json:"error"`
	CreatedBy     *person        `json:"createdBy"`
	CreatedAt     db.Time        `json:"createdAt"`
	ProcessedAt   *db.Time       `json:"processedAt"`
	ActivatedAt   *db.Time       `json:"activatedAt"`
}

func viewVersion(v Version, people map[db.ID]person) versionView {
	var failure *errorView
	if v.ErrorCode != nil {
		failure = &errorView{Code: *v.ErrorCode, Detail: v.ErrorDetail}
	}
	var creator *person
	if v.CreatedByID != nil {
		if p, ok := people[*v.CreatedByID]; ok {
			creator = &p
		}
	}
	return versionView{
		ID: v.ID, Kind: v.Kind, Version: v.Number, Origin: v.Origin, DerivedFromID: v.DerivedFromID,
		SpeciesID: v.SpeciesID, State: v.State, Active: v.Active, FileName: v.FileName, SizeBytes: v.SizeBytes,
		SHA256: v.SHA256, Metadata: v.Metadata,
		Artifacts: fn.Map(v.Artifacts, func(a Artifact) artifactView {
			return artifactView{Name: a.Name, SizeBytes: a.SizeBytes}
		}),
		Error: failure, CreatedBy: creator, CreatedAt: v.CreatedAt, ProcessedAt: v.ProcessedAt,
		ActivatedAt: v.ActivatedAt,
	}
}

func (m *Module) viewVersions(ctx context.Context, versions []Version) ([]versionView, error) {
	creators := fn.FlatMap(versions, func(v Version) []db.ID {
		if v.CreatedByID == nil {
			return nil
		}
		return []db.ID{*v.CreatedByID}
	})
	people, err := peopleOf(ctx, m.deps.DB, creators)
	if err != nil {
		return nil, err
	}
	return fn.Map(versions, func(v Version) versionView {
		if v.Metadata == nil {
			v.Metadata = map[string]any{}
		}
		return viewVersion(v, people)
	}), nil
}

type acceptView struct {
	Extensions []string `json:"extensions"`
	MediaTypes []string `json:"mediaTypes"`
	MaxBytes   int64    `json:"maxBytes"`
}

// sourceView is the JSON form of a data source kind.
type sourceView struct {
	Kind          Kind         `json:"kind"`
	Required      bool         `json:"required"`
	PerSpecies    bool         `json:"perSpecies"`
	UsedBy        []string     `json:"usedBy"`
	State         string       `json:"state"`
	SatisfiedBy   *Kind        `json:"satisfiedBy"`
	Accept        acceptView   `json:"accept"`
	ActiveVersion *versionView `json:"activeVersion"`
	LatestVersion *versionView `json:"latestVersion"`
}

type detailView struct {
	sourceView
	Versions   []versionView `json:"versions"`
	NextCursor *string       `json:"nextCursor"`
	OpenUpload *uploadView   `json:"openUpload"`
}

// sourceState gives the state of a kind from its active and newest versions.
func sourceState(active, latest *Version) string {
	switch {
	case active != nil:
		return string(StateReady)
	case latest == nil:
		return "missing"
	case latest.State == StateValidating || latest.State == StateProcessing || latest.State == StateFailed:
		return string(latest.State)
	default:
		return "missing"
	}
}

// overview reads the active and the newest version of a kind. A species
// filter of nil reads over all species.
func (m *Module) overview(ctx context.Context, spec KindSpec, species *db.ID) (sourceView, error) {
	filter, args := "WHERE kind = ?", []any{spec.Kind}
	if species != nil {
		filter, args = "WHERE "+sameGroup, []any{spec.Kind, speciesKey(species)}
	}
	active, err := m.files.versions(ctx, m.deps.DB, filter+" AND active = 1 AND state = ? ORDER BY activated_at DESC LIMIT 1",
		append(args, StateReady)...)
	if err != nil {
		return sourceView{}, err
	}
	latest, err := m.files.versions(ctx, m.deps.DB, filter+" ORDER BY created_at DESC, version DESC LIMIT 1", args...)
	if err != nil {
		return sourceView{}, err
	}
	views, err := m.viewVersions(ctx, append(active, latest...))
	if err != nil {
		return sourceView{}, err
	}
	out := sourceView{
		Kind: spec.Kind, Required: spec.Required, PerSpecies: spec.PerSpecies, UsedBy: spec.UsedBy,
		State:  sourceState(first(active), first(latest)),
		Accept: acceptView{Extensions: spec.Extensions, MediaTypes: spec.MediaTypes, MaxBytes: spec.MaxBytes},
	}
	if len(active) > 0 {
		out.ActiveVersion = &views[0]
		out.SatisfiedBy, err = m.satisfiedBy(ctx, active[0])
		if err != nil {
			return out, err
		}
	}
	if len(latest) > 0 {
		out.LatestVersion = &views[len(views)-1]
	}
	return out, nil
}

func first(versions []Version) *Version {
	if len(versions) == 0 {
		return nil
	}
	return &versions[0]
}

// satisfiedBy gives the kind of the version that made the active version,
// when that kind differs.
func (m *Module) satisfiedBy(ctx context.Context, active Version) (*Kind, error) {
	if active.DerivedFromID == nil {
		return nil, nil
	}
	kind, found, err := db.Maybe(ctx, m.deps.DB, func(s db.Scanner) (Kind, error) {
		var k Kind
		return k, s.Scan(&k)
	}, "SELECT kind FROM data_source_version WHERE id = ?", *active.DerivedFromID)
	if err != nil || !found || kind == active.Kind {
		return nil, err
	}
	return &kind, nil
}

func (m *Module) listSources(r *http.Request) (web.Response, error) {
	items, err := fn.MapErr(Kinds, func(spec KindSpec) (sourceView, error) {
		return m.overview(r.Context(), spec, nil)
	})
	if err != nil {
		return nil, err
	}
	return web.OK(map[string][]sourceView{"items": items}), nil
}

func (m *Module) getSource(r *http.Request) (web.Response, error) {
	spec, ok := SpecOf(Kind(r.PathValue("kind")))
	if !ok {
		return nil, problem.NotFound()
	}
	page, err := paging.FromRequest(r, 50)
	if err != nil {
		return nil, err
	}
	var species *db.ID
	if raw := web.Query(r, "speciesId"); raw != nil {
		id, err := db.ParseID(*raw)
		if err != nil {
			return nil, problem.InvalidField("speciesId", "uuid_parsing")
		}
		species = &id
	}
	ctx := r.Context()
	head, err := m.overview(ctx, spec, species)
	if err != nil {
		return nil, err
	}
	filter, args := "WHERE kind = ?", []any{spec.Kind}
	if species != nil {
		filter, args = "WHERE "+sameGroup, []any{spec.Kind, speciesKey(species)}
	}
	limit, offset := page.SQL()
	found, err := m.files.versions(ctx, m.deps.DB, filter+" ORDER BY created_at DESC, version DESC LIMIT ? OFFSET ?",
		append(args, limit, offset)...)
	if err != nil {
		return nil, err
	}
	views, err := m.viewVersions(ctx, found)
	if err != nil {
		return nil, err
	}
	paged := paging.Wrap(views, page)
	out := detailView{sourceView: head, Versions: paged.Items, NextCursor: paged.NextCursor}
	now := m.now()
	if u, open, err := openUpload(ctx, m.deps.DB, spec.Kind, species, now); err != nil {
		return nil, err
	} else if open {
		view := viewUpload(u, now)
		out.OpenUpload = &view
	}
	return web.OK(out), nil
}

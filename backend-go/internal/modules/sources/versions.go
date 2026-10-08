package sources

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// keepSuperseded is the count of superseded versions per kind and species
// that stay for a rollback.
const keepSuperseded = 2

// activate makes the version the active one of its kind and species. The
// earlier active version becomes superseded. Versions that the processing
// of this version made are activated too.
func (m *Module) activate(ctx context.Context, id db.ID) (Version, error) {
	var removed []Version
	err := db.InTx(ctx, m.deps.DB, func(tx *sql.Tx) error {
		var err error
		removed, err = m.activateTx(ctx, tx, id)
		return err
	})
	if err != nil {
		return Version{}, err
	}
	m.removeFolders(removed)
	return m.files.version(ctx, m.deps.DB, id)
}

func (m *Module) activateTx(ctx context.Context, tx *sql.Tx, id db.ID) ([]Version, error) {
	v, err := m.files.version(ctx, tx, id)
	if err != nil {
		return nil, err
	}
	if v.State != StateReady && v.State != StateSuperseded {
		return nil, problem.Conflict("not_ready", "the version is "+string(v.State))
	}
	key := speciesKey(v.SpeciesID)
	if _, err := tx.ExecContext(ctx, `UPDATE data_source_version SET active = 0, state = ?
		WHERE `+sameGroup+" AND active = 1 AND id != ?", StateSuperseded, v.Kind, key, id); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE data_source_version SET active = 1, state = ?, activated_at = ?
		WHERE id = ?`, StateReady, m.now(), id); err != nil {
		return nil, err
	}
	removed, err := m.retain(ctx, tx, v.Kind, v.SpeciesID)
	if err != nil {
		return nil, err
	}
	children, err := db.Column[db.ID](ctx, tx, `SELECT id FROM data_source_version
		WHERE derived_from_id = ? AND origin = ? AND state IN (?, ?) ORDER BY version`,
		id, OriginDerived, StateReady, StateSuperseded)
	if err != nil {
		return nil, err
	}
	for _, child := range children {
		more, err := m.activateTx(ctx, tx, child)
		if err != nil {
			return nil, err
		}
		removed = append(removed, more...)
	}
	return removed, nil
}

// retain deletes the superseded versions after the newest keepSuperseded.
// It gives the deleted versions, whose folders the caller removes.
func (m *Module) retain(ctx context.Context, tx *sql.Tx, kind Kind, species *db.ID) ([]Version, error) {
	old, err := m.files.versions(ctx, tx, "WHERE "+sameGroup+` AND state = ?
		ORDER BY version DESC LIMIT -1 OFFSET ?`, kind, speciesKey(species), StateSuperseded, keepSuperseded)
	if err != nil {
		return nil, err
	}
	for _, v := range old {
		if _, err := tx.ExecContext(ctx, "DELETE FROM data_source_version WHERE id = ?", v.ID); err != nil {
			return nil, err
		}
	}
	return old, nil
}

// removeFolders removes the folders of deleted versions. A folder outside
// the data root stays.
func (m *Module) removeFolders(versions []Version) {
	for _, v := range versions {
		if !m.files.inside(v.Dir) {
			continue
		}
		if err := os.RemoveAll(v.Dir); err != nil {
			m.deps.Log.Warn("remove data source folder", "path", v.Dir, "error", err)
		}
	}
}

// pathVersion reads the version of the path and checks that its kind agrees.
func (m *Module) pathVersion(r *http.Request) (Version, error) {
	id, err := web.PathID(r, "versionId")
	if err != nil {
		return Version{}, err
	}
	v, err := m.files.version(r.Context(), m.deps.DB, id)
	if err != nil {
		return v, err
	}
	if string(v.Kind) != r.PathValue("kind") {
		return v, problem.NotFound()
	}
	return v, nil
}

func (m *Module) getVersion(r *http.Request) (web.Response, error) {
	v, err := m.pathVersion(r)
	if err != nil {
		return nil, err
	}
	views, err := m.viewVersions(r.Context(), []Version{v})
	if err != nil {
		return nil, err
	}
	return web.OK(views[0]), nil
}

func (m *Module) noRunActive(ctx context.Context) error {
	active, err := runActive(ctx, m.deps.DB)
	if err != nil {
		return err
	}
	if active {
		return problem.Conflict("run_active", "a pipeline run is running")
	}
	return nil
}

func (m *Module) activateVersion(r *http.Request) (web.Response, error) {
	v, err := m.pathVersion(r)
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	if err := m.noRunActive(ctx); err != nil {
		return nil, err
	}
	activated, err := m.activate(ctx, v.ID)
	if err != nil {
		return nil, err
	}
	views, err := m.viewVersions(ctx, []Version{activated})
	if err != nil {
		return nil, err
	}
	return web.OK(views[0]), nil
}

func busy(v Version) bool { return v.State == StateValidating || v.State == StateProcessing }

func (m *Module) reprocessVersion(r *http.Request) (web.Response, error) {
	v, err := m.pathVersion(r)
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	if err := m.noRunActive(ctx); err != nil {
		return nil, err
	}
	if busy(v) {
		return nil, problem.Conflict("run_active", "the version is "+string(v.State))
	}
	if original := v.Original(); original == "" || !exists(original) {
		return nil, problem.Conflict("no_original", "the version has no uploaded file")
	}
	if err := setState(ctx, m.deps.DB, v.ID, StateValidating); err != nil {
		return nil, err
	}
	m.schedule(v.ID, v.Active)
	v.State = StateValidating
	views, err := m.viewVersions(ctx, []Version{v})
	if err != nil {
		return nil, err
	}
	return web.JSON(http.StatusAccepted, views[0]), nil
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func (m *Module) deleteVersion(r *http.Request) (web.Response, error) {
	v, err := m.pathVersion(r)
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	if err := m.noRunActive(ctx); err != nil {
		return nil, err
	}
	if busy(v) {
		return nil, problem.Conflict("run_active", "the version is "+string(v.State))
	}
	var removed []Version
	err = db.InTx(ctx, m.deps.DB, func(tx *sql.Tx) error {
		var err error
		removed, err = m.deleteTx(ctx, tx, v)
		return err
	})
	if err != nil {
		return nil, err
	}
	m.removeFolders(append(removed, v))
	return web.Empty(http.StatusNoContent), nil
}

// deleteTx deletes a version. An active version gives its place to the
// newest other usable version. A required kind keeps at least one.
func (m *Module) deleteTx(ctx context.Context, tx *sql.Tx, v Version) ([]Version, error) {
	var removed []Version
	if v.Active {
		others, err := db.Column[db.ID](ctx, tx, `SELECT id FROM data_source_version
			WHERE `+sameGroup+" AND id != ? AND state IN (?, ?) ORDER BY version DESC LIMIT 1",
			v.Kind, speciesKey(v.SpeciesID), v.ID, StateReady, StateSuperseded)
		if err != nil {
			return nil, err
		}
		spec, _ := SpecOf(v.Kind)
		switch {
		case len(others) > 0:
			if removed, err = m.activateTx(ctx, tx, others[0]); err != nil {
				return nil, err
			}
		case spec.Required:
			return nil, problem.Conflict("in_use", "the version is active and the kind is required")
		}
	}
	_, err := tx.ExecContext(ctx, "DELETE FROM data_source_version WHERE id = ?", v.ID)
	return fn.Filter(removed, func(r Version) bool { return r.ID != v.ID }), err
}

// defaultTail is the count of log lines without the query value tail.
const defaultTail = 200

func (m *Module) versionLog(r *http.Request) (web.Response, error) {
	v, err := m.pathVersion(r)
	if err != nil {
		return nil, err
	}
	tail := defaultTail
	if raw := web.Query(r, "tail"); raw != nil {
		if tail, err = strconv.Atoi(*raw); err != nil {
			return nil, problem.InvalidField("tail", "int_parsing")
		}
	}
	lines := []string{}
	if v.LogPath != nil {
		content, err := os.ReadFile(m.files.abs(*v.LogPath))
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return nil, err
		}
		lines = lastLines(string(content), tail)
	}
	return web.OK(map[string][]string{"lines": lines}), nil
}

// lastLines gives the last n lines of text. A line end at the end gives no empty line.
func lastLines(text string, n int) []string {
	if text == "" {
		return []string{}
	}
	all := strings.Split(strings.TrimSuffix(text, "\n"), "\n")
	return all[max(0, len(all)-n):]
}

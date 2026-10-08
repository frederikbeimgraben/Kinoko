package sources

import (
	"context"
	"encoding/json"
	"path/filepath"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

const versionCols = `id, kind, version, origin, derived_from_id, state, active, file_name, size_bytes,
	sha256, storage_path, species_id, metadata, error_code, error_detail, log_path, created_by_id,
	created_at, processed_at, activated_at`

func scanVersion(s db.Scanner) (Version, error) {
	var v Version
	var metadata string
	err := s.Scan(&v.ID, &v.Kind, &v.Number, &v.Origin, &v.DerivedFromID, &v.State, &v.Active,
		&v.FileName, &v.SizeBytes, &v.SHA256, &v.StoragePath, &v.SpeciesID, &metadata,
		&v.ErrorCode, &v.ErrorDetail, &v.LogPath, &v.CreatedByID, &v.CreatedAt, &v.ProcessedAt, &v.ActivatedAt)
	if err != nil {
		return v, err
	}
	v.Metadata = map[string]any{}
	if metadata != "" {
		if err := json.Unmarshal([]byte(metadata), &v.Metadata); err != nil {
			return v, err
		}
	}
	return v, nil
}

// files keeps the paths of the stored files relative to the data root, so
// the root can move.
type files struct{ root string }

func (f files) abs(rel string) string { return filepath.Join(f.root, filepath.FromSlash(rel)) }

// rel gives the path under the root. A path outside the root stays absolute.
func (f files) rel(abs string) string {
	rel, err := filepath.Rel(f.root, abs)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return abs
	}
	return filepath.ToSlash(rel)
}

// inside tells if the path is a strict child of the root. Only such a path
// may be removed.
func (f files) inside(abs string) bool {
	rel := f.rel(abs)
	return rel != abs && rel != "." && rel != ""
}

// complete sets the folder and reads the artifacts of each version.
func (f files) complete(ctx context.Context, q db.Querier, versions []Version) ([]Version, error) {
	if len(versions) == 0 {
		return versions, nil
	}
	ids := fn.Map(versions, func(v Version) db.ID { return v.ID })
	type row struct {
		version db.ID
		a       Artifact
	}
	rows, err := db.All(ctx, q, func(s db.Scanner) (row, error) {
		var r row
		err := s.Scan(&r.version, &r.a.Name, &r.a.Path, &r.a.SizeBytes, &r.a.SHA256)
		r.a.Path = f.abs(r.a.Path)
		return r, err
	}, `SELECT version_id, name, path, size_bytes, sha256 FROM data_source_artifact
		WHERE version_id IN (`+db.Placeholders(len(ids))+`) ORDER BY name`, db.Args(ids)...)
	if err != nil {
		return nil, err
	}
	grouped := fn.GroupBy(rows, func(r row) db.ID { return r.version })
	return fn.Map(versions, func(v Version) Version {
		v.Dir = f.abs(v.StoragePath)
		v.Artifacts = fn.Map(grouped[v.ID], func(r row) Artifact { return r.a })
		return v
	}), nil
}

func (f files) versions(ctx context.Context, q db.Querier, where string, args ...any) ([]Version, error) {
	found, err := db.All(ctx, q, scanVersion, "SELECT "+versionCols+" FROM data_source_version "+where, args...)
	if err != nil {
		return nil, err
	}
	return f.complete(ctx, q, found)
}

func (f files) version(ctx context.Context, q db.Querier, id db.ID) (Version, error) {
	v, err := db.One(ctx, q, scanVersion, "SELECT "+versionCols+" FROM data_source_version WHERE id = ?", id)
	if err != nil {
		return v, err
	}
	all, err := f.complete(ctx, q, []Version{v})
	if err != nil {
		return v, err
	}
	return all[0], nil
}

// speciesKey gives the value that groups versions by species in SQL.
func speciesKey(id *db.ID) string {
	if id == nil {
		return ""
	}
	value, _ := id.Value()
	return value.(string)
}

const sameGroup = "kind = ? AND coalesce(species_id, '') = ?"

func nextNumber(ctx context.Context, q db.Querier, kind Kind, species *db.ID) (int, error) {
	return db.Scalar[int](ctx, q, "SELECT coalesce(max(version), 0) + 1 FROM data_source_version WHERE "+sameGroup,
		kind, speciesKey(species))
}

func insertVersion(ctx context.Context, q db.Querier, v Version) error {
	metadata, err := encodeMetadata(v.Metadata)
	if err != nil {
		return err
	}
	_, err = q.ExecContext(ctx, "INSERT INTO data_source_version ("+versionCols+`)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		v.ID, v.Kind, v.Number, v.Origin, v.DerivedFromID, v.State, v.Active, v.FileName, v.SizeBytes,
		v.SHA256, v.StoragePath, v.SpeciesID, metadata, v.ErrorCode, v.ErrorDetail, v.LogPath,
		v.CreatedByID, v.CreatedAt, v.ProcessedAt, v.ActivatedAt)
	return err
}

func (f files) replaceArtifacts(ctx context.Context, q db.Querier, version db.ID, artifacts []Artifact) error {
	if _, err := q.ExecContext(ctx, "DELETE FROM data_source_artifact WHERE version_id = ?", version); err != nil {
		return err
	}
	for _, a := range artifacts {
		if _, err := q.ExecContext(ctx, `INSERT INTO data_source_artifact (version_id, name, path, size_bytes, sha256)
			VALUES (?, ?, ?, ?, ?)`, version, a.Name, f.rel(a.Path), a.SizeBytes, a.SHA256); err != nil {
			return err
		}
	}
	return nil
}

const uploadCols = `id, kind, species_id, file_name, size_bytes, expected_sha256, received_bytes, part_size,
	hash_state, temp_path, activate, state, version_id, created_by_id, created_at, expires_at`

func scanUpload(s db.Scanner) (upload, error) {
	var u upload
	err := s.Scan(&u.ID, &u.Kind, &u.SpeciesID, &u.FileName, &u.SizeBytes, &u.ExpectedSHA256, &u.ReceivedBytes,
		&u.PartSize, &u.HashState, &u.TempPath, &u.Activate, &u.State, &u.VersionID, &u.CreatedByID,
		&u.CreatedAt, &u.ExpiresAt)
	return u, err
}

func getUpload(ctx context.Context, q db.Querier, id db.ID) (upload, error) {
	return db.One(ctx, q, scanUpload, "SELECT "+uploadCols+" FROM data_source_upload WHERE id = ?", id)
}

func insertUpload(ctx context.Context, q db.Querier, u upload) error {
	_, err := q.ExecContext(ctx, "INSERT INTO data_source_upload ("+uploadCols+`)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		u.ID, u.Kind, u.SpeciesID, u.FileName, u.SizeBytes, u.ExpectedSHA256, u.ReceivedBytes, u.PartSize,
		u.HashState, u.TempPath, u.Activate, u.State, u.VersionID, u.CreatedByID, u.CreatedAt, u.ExpiresAt)
	return err
}

// openUpload gives the open, not expired upload of a kind and species, if one exists.
func openUpload(ctx context.Context, q db.Querier, kind Kind, species *db.ID, now db.Time) (upload, bool, error) {
	return db.Maybe(ctx, q, scanUpload, "SELECT "+uploadCols+` FROM data_source_upload
		WHERE state = 'open' AND expires_at > ? AND `+sameGroup+" ORDER BY created_at DESC LIMIT 1",
		now, kind, speciesKey(species))
}

// runActive tells if a pipeline run is running. Its inputs must not change.
func runActive(ctx context.Context, q db.Querier) (bool, error) {
	n, err := db.Scalar[int](ctx, q, "SELECT count(*) FROM pipeline_run WHERE state = ?", enums.RunStateRunning)
	return n > 0, err
}

func setState(ctx context.Context, q db.Querier, id db.ID, state VersionState) error {
	_, err := q.ExecContext(ctx, "UPDATE data_source_version SET state = ? WHERE id = ?", state, id)
	return err
}

type person struct {
	ID   db.ID   `json:"id"`
	Name *string `json:"name"`
}

func peopleOf(ctx context.Context, q db.Querier, ids []db.ID) (map[db.ID]person, error) {
	if len(ids) == 0 {
		return map[db.ID]person{}, nil
	}
	unique := fn.SortedKeys(fn.Set(fn.Map(ids, db.ID.String)))
	found, err := db.All(ctx, q, func(s db.Scanner) (person, error) {
		var p person
		return p, s.Scan(&p.ID, &p.Name)
	}, "SELECT id, name FROM user WHERE id IN ("+db.Placeholders(len(unique))+")",
		db.Args(fn.Map(unique, db.MustID))...)
	if err != nil {
		return nil, err
	}
	return fn.KeyBy(found, func(p person) db.ID { return p.ID }), nil
}

func encodeMetadata(metadata map[string]any) (string, error) {
	if metadata == nil {
		return "{}", nil
	}
	encoded, err := json.Marshal(metadata)
	return string(encoded), err
}

package sources

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

// JobLock lets one heavy job run at a time: the processing of a version or
// a pipeline run. The pipeline runner holds it for the length of a run.
var JobLock sync.Mutex

var registry = struct {
	sync.RWMutex
	processors map[Kind]Processor
}{processors: map[Kind]Processor{}}

// Register sets the processor of a kind. A registered processor replaces
// the built-in one. The pipeline units call it for the raster kinds.
func Register(kind Kind, p Processor) {
	registry.Lock()
	defer registry.Unlock()
	registry.processors[kind] = p
}

func (m *Module) processor(kind Kind) (Processor, bool) {
	registry.RLock()
	p, ok := registry.processors[kind]
	registry.RUnlock()
	if ok {
		return p, true
	}
	p, ok = m.builtins[kind]
	return p, ok
}

// schedule starts the processing of a version in the background.
func (m *Module) schedule(id db.ID, activate bool) {
	m.work.Add(1)
	go func() {
		defer m.work.Done()
		if err := m.process(context.Background(), id, activate); err != nil {
			m.deps.Log.Error("process data source version", "version", id, "error", err)
		}
	}()
}

// resume starts the processing again for each version that a stopped
// process left in validating or processing.
func (m *Module) resume(ctx context.Context) error {
	type pending struct {
		id       db.ID
		activate bool
	}
	found, err := db.All(ctx, m.deps.DB, func(s db.Scanner) (pending, error) {
		var p pending
		return p, s.Scan(&p.id, &p.activate)
	}, `SELECT v.id, coalesce((SELECT u.activate FROM data_source_upload u WHERE u.version_id = v.id), v.active)
		FROM data_source_version v WHERE v.state IN (?, ?) ORDER BY v.created_at`, StateValidating, StateProcessing)
	if err != nil {
		return err
	}
	for _, p := range found {
		if err := setState(ctx, m.deps.DB, p.id, StateValidating); err != nil {
			return err
		}
		m.schedule(p.id, p.activate)
	}
	return nil
}

// process validates and derives one version, then activates it when asked.
// A failure goes into the version row, not into the returned error.
func (m *Module) process(ctx context.Context, id db.ID, activate bool) error {
	JobLock.Lock()
	defer JobLock.Unlock()
	v, err := m.files.version(ctx, m.deps.DB, id)
	if err != nil {
		return err
	}
	logPath := filepath.Join(v.Dir, "process.log")
	if err := os.MkdirAll(v.Dir, 0o755); err != nil {
		return err
	}
	logFile, err := os.Create(logPath)
	if err != nil {
		return err
	}
	defer logFile.Close()
	v.Log = logFile
	if _, err := m.deps.DB.ExecContext(ctx, `UPDATE data_source_version SET state = ?, log_path = ?,
		error_code = NULL, error_detail = NULL WHERE id = ?`, StateValidating, m.files.rel(logPath), id); err != nil {
		return err
	}
	artifacts, failure := m.run(ctx, &v)
	if failure != nil {
		code, detail := failureOf(failure, "failed")
		v.Logf("failed: %s: %s", code, detail)
		_, err := m.deps.DB.ExecContext(ctx, `UPDATE data_source_version SET state = ?, active = 0,
			error_code = ?, error_detail = ?, processed_at = ? WHERE id = ?`, StateFailed, code, detail, m.now(), id)
		return err
	}
	children, err := m.finish(ctx, v, artifacts)
	if err != nil {
		return err
	}
	v.Logf("ready: %d artifacts, %d new versions", len(artifacts), len(children))
	if !activate {
		return nil
	}
	_, err = m.activate(ctx, id)
	return err
}

// run calls the processor. A panic of the processor fails the version.
func (m *Module) run(ctx context.Context, v *Version) (artifacts []Artifact, failure error) {
	defer func() {
		if value := recover(); value != nil {
			failure = Fail("internal", "processor stopped: %v", value)
		}
	}()
	p, ok := m.processor(v.Kind)
	if !ok {
		return nil, Fail("processor_missing", "the service cannot process the kind %s", v.Kind)
	}
	v.Logf("validate %s version %d", v.Kind, v.Number)
	metadata, err := p.Validate(ctx, v)
	if err != nil {
		code, detail := failureOf(err, "invalid")
		return nil, &Failure{Code: code, Detail: detail}
	}
	encoded, err := encodeMetadata(metadata)
	if err != nil {
		return nil, err
	}
	if _, err := m.deps.DB.ExecContext(ctx, "UPDATE data_source_version SET state = ?, metadata = ? WHERE id = ?",
		StateProcessing, encoded, v.ID); err != nil {
		return nil, err
	}
	v.Metadata = metadata
	v.Logf("derive %s version %d", v.Kind, v.Number)
	artifacts, err = p.Derive(ctx, v)
	if err != nil {
		code, detail := failureOf(err, "derive_failed")
		return nil, &Failure{Code: code, Detail: detail}
	}
	return artifacts, nil
}

// finish stores the artifacts, installs the spawned versions and sets the
// version to ready.
func (m *Module) finish(ctx context.Context, v Version, artifacts []Artifact) ([]Version, error) {
	children := []Version{}
	for i, a := range artifacts {
		if a.Spawn == nil {
			continue
		}
		child, err := m.Install(ctx, Install{
			Kind: a.Spawn.Kind, SpeciesID: &a.Spawn.SpeciesID, Origin: OriginDerived, DerivedFromID: &v.ID,
			From: a.Path, FileName: v.FileName, CreatedByID: v.CreatedByID,
		})
		if err != nil {
			return nil, err
		}
		artifacts[i].Path = child.Dir
		children = append(children, child)
	}
	err := db.InTx(ctx, m.deps.DB, func(tx *sql.Tx) error {
		if err := m.files.replaceArtifacts(ctx, tx, v.ID, artifacts); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, "UPDATE data_source_version SET state = ?, processed_at = ? WHERE id = ?",
			StateReady, m.now(), v.ID)
		return err
	})
	return children, err
}

// Install describes a folder that becomes a ready version, for example a
// model that a training run made.
type Install struct {
	Kind          Kind
	SpeciesID     *db.ID
	Origin        Origin
	DerivedFromID *db.ID
	// From is the folder to move into the version. The service owns it after the call.
	From        string
	FileName    *string
	Metadata    map[string]any
	CreatedByID *db.ID
	// Artifact names the folder as an artifact of the new version. Empty means "bundle".
	Artifact string
	// Activate activates the version at once.
	Activate bool
}

// Install moves a folder into a new ready version. A model of a species goes
// to models/<slug>/v<N>; another kind goes to sources/<kind>/v<N>.
func (m *Module) Install(ctx context.Context, in Install) (Version, error) {
	if !in.Kind.Valid() {
		return Version{}, fmt.Errorf("sources: unknown kind %q", in.Kind)
	}
	name := in.Artifact
	if name == "" {
		name = "bundle"
	}
	var target string
	v, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (Version, error) {
		number, err := nextNumber(ctx, tx, in.Kind, in.SpeciesID)
		if err != nil {
			return Version{}, err
		}
		rel, err := installPath(ctx, tx, in.Kind, in.SpeciesID, number)
		if err != nil {
			return Version{}, err
		}
		now := m.now()
		v := Version{
			ID: db.NewID(), Kind: in.Kind, Number: number, Origin: in.Origin, DerivedFromID: in.DerivedFromID,
			State: StateReady, FileName: in.FileName, StoragePath: rel, SpeciesID: in.SpeciesID,
			Metadata: in.Metadata, CreatedByID: in.CreatedByID, CreatedAt: now, ProcessedAt: &now,
		}
		v.Dir = m.files.abs(rel)
		size, err := treeSize(in.From)
		if err != nil {
			return v, err
		}
		v.SizeBytes = &size
		if err := insertVersion(ctx, tx, v); err != nil {
			return v, err
		}
		v.Artifacts = []Artifact{{Name: name, Path: v.Dir, SizeBytes: size}}
		if err := m.files.replaceArtifacts(ctx, tx, v.ID, v.Artifacts); err != nil {
			return v, err
		}
		target = v.Dir
		if err := os.RemoveAll(target); err != nil {
			return v, err
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return v, err
		}
		return v, os.Rename(in.From, target)
	})
	if err != nil {
		return v, err
	}
	if in.Activate {
		return m.activate(ctx, v.ID)
	}
	return v, nil
}

func installPath(ctx context.Context, q db.Querier, kind Kind, species *db.ID, number int) (string, error) {
	if kind != KindModelBundle || species == nil {
		return versionPath(kind, species, number), nil
	}
	slug, err := db.Scalar[string](ctx, q, "SELECT slug FROM species WHERE id = ?", *species)
	if errors.Is(err, sql.ErrNoRows) {
		return "", fmt.Errorf("sources: species %s does not exist", species)
	}
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("models/%s/v%d", slug, number), nil
}

// treeSize gives the bytes of a file or of all files in a folder.
func treeSize(path string) (int64, error) {
	var total int64
	err := filepath.WalkDir(path, func(_ string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return err
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		total += info.Size()
		return nil
	})
	return total, err
}

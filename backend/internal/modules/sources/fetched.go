package sources

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

// Wanted tells if the service should fetch a kind itself: it has no active,
// ready version, and no version of it is in processing, for example an upload
// that waits for the end of a run.
func (m *Module) Wanted(ctx context.Context, kind Kind) (bool, error) {
	n, err := db.Scalar[int](ctx, m.deps.DB, `SELECT count(*) FROM data_source_version WHERE `+sameGroup+`
		AND ((active = 1 AND state = ?) OR state IN (?, ?))`,
		kind, speciesKey(nil), StateReady, StateValidating, StateProcessing)
	return n == 0, err
}

// AddFile turns a fetched file into a version, as an upload does, and
// processes and activates it at once; the caller holds JobLock. A failed
// check goes into the version row, whose state is then failed.
func (m *Module) AddFile(ctx context.Context, kind Kind, file, fileName string) (Version, error) {
	spec, ok := SpecOf(kind)
	if !ok || spec.PerSpecies {
		return Version{}, fmt.Errorf("sources: the kind %q takes no fetched file", kind)
	}
	if _, ok := spec.extensionOf(fileName); !ok {
		return Version{}, fmt.Errorf("sources: %s does not take the file %s", kind, fileName)
	}
	size, sum, err := fileSum(file)
	if err != nil {
		return Version{}, err
	}
	v, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (Version, error) {
		number, err := nextNumber(ctx, tx, kind, nil)
		if err != nil {
			return Version{}, err
		}
		v := Version{
			ID: db.NewID(), Kind: kind, Number: number, Origin: OriginUpload, State: StateValidating,
			FileName: &fileName, SizeBytes: &size, SHA256: &sum, Metadata: map[string]any{}, CreatedAt: m.now(),
		}
		v.StoragePath = versionPath(kind, nil, number)
		v.Dir = m.files.abs(v.StoragePath)
		if err := insertVersion(ctx, tx, v); err != nil {
			return v, err
		}
		if err := os.RemoveAll(v.Dir); err != nil {
			return v, err
		}
		if err := os.MkdirAll(v.Dir, 0o755); err != nil {
			return v, err
		}
		return v, os.Rename(file, v.Original())
	})
	if err != nil {
		return v, err
	}
	if err := m.processLocked(ctx, v.ID, true); err != nil {
		return v, err
	}
	return m.files.version(ctx, m.deps.DB, v.ID)
}

// fileSum gives the size and the SHA-256 of a file.
func fileSum(path string) (size int64, sum string, err error) {
	f, err := os.Open(filepath.Clean(path))
	if err != nil {
		return 0, "", err
	}
	defer func() { err = errors.Join(err, f.Close()) }()
	h := sha256.New()
	size, err = io.Copy(h, f)
	return size, hex.EncodeToString(h.Sum(nil)), err
}

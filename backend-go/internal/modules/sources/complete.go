package sources

import (
	"context"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
)

type completeBody struct {
	SHA256 *string `json:"sha256"`
}

// readComplete reads the optional body of completeUpload.
func readComplete(r *http.Request) (completeBody, error) {
	var body completeBody
	raw, err := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if err != nil {
		return body, problem.InvalidField("body", "read")
	}
	if len(raw) == 0 {
		return body, nil
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		return body, problem.InvalidField("body", "json_invalid")
	}
	return body, nil
}

func (m *Module) completeUpload(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	body, err := readComplete(r)
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	lock := m.lock(id)
	lock.Lock()
	defer lock.Unlock()
	u, err := m.usable(ctx, id)
	if err != nil {
		return nil, err
	}
	if u.ReceivedBytes != u.SizeBytes {
		return nil, problem.Conflict("incomplete", fmt.Sprintf("%d of %d bytes received", u.ReceivedBytes, u.SizeBytes))
	}
	h, err := restoreHash(u.HashState)
	if err != nil {
		return nil, err
	}
	sum := hex.EncodeToString(h.Sum(nil))
	for _, expected := range []*string{u.ExpectedSHA256, body.SHA256} {
		if expected != nil && *expected != sum {
			return nil, problem.Conflict("checksum_mismatch", "the SHA-256 of the file is "+sum)
		}
	}
	v, err := m.installUpload(ctx, u, sum)
	if err != nil {
		return nil, err
	}
	m.locks.Delete(id)
	m.schedule(v.ID, u.Activate)
	view, err := m.viewVersions(ctx, []Version{v})
	if err != nil {
		return nil, err
	}
	return web.JSON(http.StatusAccepted, view[0]), nil
}

// installUpload moves the file into a new version folder and adds the
// version in the state validating.
func (m *Module) installUpload(ctx context.Context, u upload, sum string) (Version, error) {
	var moved func() error
	v, err := db.InTxValue(ctx, m.deps.DB, func(tx *sql.Tx) (Version, error) {
		number, err := nextNumber(ctx, tx, u.Kind, u.SpeciesID)
		if err != nil {
			return Version{}, err
		}
		size := u.SizeBytes
		v := Version{
			ID: db.NewID(), Kind: u.Kind, Number: number, Origin: OriginUpload, State: StateValidating,
			FileName: &u.FileName, SizeBytes: &size, SHA256: &sum, SpeciesID: u.SpeciesID,
			Metadata: map[string]any{}, CreatedByID: u.CreatedByID, CreatedAt: m.now(),
		}
		v.StoragePath = versionPath(u.Kind, u.SpeciesID, number)
		v.Dir = m.files.abs(v.StoragePath)
		if err := insertVersion(ctx, tx, v); err != nil {
			return v, err
		}
		if _, err := tx.ExecContext(ctx, "UPDATE data_source_upload SET state = ?, version_id = ? WHERE id = ?",
			UploadComplete, v.ID, u.ID); err != nil {
			return v, err
		}
		moved, err = m.moveInto(u, v)
		return v, err
	})
	if err != nil && moved != nil {
		err = errors.Join(err, moved())
	}
	return v, err
}

// moveInto moves the upload file to the original file of the version. It
// gives the function that moves the file back.
func (m *Module) moveInto(u upload, v Version) (func() error, error) {
	if err := os.RemoveAll(v.Dir); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(v.Dir, 0o755); err != nil {
		return nil, err
	}
	from, to := m.files.abs(u.TempPath), v.Original()
	if err := os.Rename(from, to); err != nil {
		return nil, err
	}
	return func() error { return os.Rename(to, from) }, nil
}

// versionPath gives the folder of a version under the data root.
func versionPath(kind Kind, species *db.ID, number int) string {
	if species != nil {
		return fmt.Sprintf("sources/%s/%s/v%d", kind, species.String(), number)
	}
	return fmt.Sprintf("sources/%s/v%d", kind, number)
}

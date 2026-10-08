package sources

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding"
	"errors"
	"fmt"
	"hash"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
)

const (
	// PartSize is the largest part of one PATCH. It stays below the body
	// limit of the proxy.
	PartSize = 16 << 20
	// uploadTTL is the time that an open session waits for the next part.
	uploadTTL = 24 * time.Hour
	// diskReserve is the free space that an upload must leave on the disk.
	diskReserve = 1 << 30
)

// uploadView is the JSON form of an upload session.
type uploadView struct {
	ID            db.ID       `json:"id"`
	Kind          Kind        `json:"kind"`
	SpeciesID     *db.ID      `json:"speciesId"`
	FileName      string      `json:"fileName"`
	SizeBytes     int64       `json:"sizeBytes"`
	ReceivedBytes int64       `json:"receivedBytes"`
	PartSize      int64       `json:"partSize"`
	State         UploadState `json:"state"`
	ExpiresAt     db.Time     `json:"expiresAt"`
	VersionID     *db.ID      `json:"versionId"`
}

func viewUpload(u upload, now db.Time) uploadView {
	state := u.State
	if state == UploadOpen && expired(u, now) {
		state = UploadExpired
	}
	return uploadView{
		ID: u.ID, Kind: u.Kind, SpeciesID: u.SpeciesID, FileName: u.FileName, SizeBytes: u.SizeBytes,
		ReceivedBytes: u.ReceivedBytes, PartSize: u.PartSize, State: state, ExpiresAt: u.ExpiresAt,
		VersionID: u.VersionID,
	}
}

func expired(u upload, now db.Time) bool { return !now.Before(u.ExpiresAt.Time) }

// needDisk gives the free bytes that an upload of size bytes needs: the
// file, its derived files and a reserve.
func needDisk(size int64) uint64 { return 2*uint64(size) + diskReserve }

type createBody struct {
	FileName  string  `json:"fileName"`
	SizeBytes int64   `json:"sizeBytes"`
	SHA256    *string `json:"sha256"`
	SpeciesID *db.ID  `json:"speciesId"`
	Activate  *bool   `json:"activate"`
}

func (m *Module) createUpload(r *http.Request) (web.Response, error) {
	user, _, err := m.deps.Auth.CurrentUser(r)
	if err != nil {
		return nil, err
	}
	kind := Kind(r.PathValue("kind"))
	spec, ok := SpecOf(kind)
	if !ok {
		return nil, problem.NotFound()
	}
	body, err := web.Decode[createBody](r)
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	if err := m.checkCreate(ctx, spec, body); err != nil {
		return nil, err
	}
	dir := m.files.abs("uploads")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	if err := m.checkDisk(dir, body.SizeBytes); err != nil {
		return nil, err
	}
	state, err := hashState(sha256.New())
	if err != nil {
		return nil, err
	}
	now := m.now()
	u := upload{
		ID: db.NewID(), Kind: kind, SpeciesID: body.SpeciesID, FileName: body.FileName,
		SizeBytes: body.SizeBytes, ExpectedSHA256: body.SHA256, PartSize: PartSize, HashState: state,
		Activate: body.Activate == nil || *body.Activate, State: UploadOpen, CreatedByID: &user.ID,
		CreatedAt: now, ExpiresAt: db.At(now.Add(uploadTTL)),
	}
	path := filepath.Join(dir, u.ID.String()+".part")
	u.TempPath = m.files.rel(path)
	err = db.InTx(ctx, m.deps.DB, func(tx *sql.Tx) error {
		_, open, err := openUpload(ctx, tx, kind, body.SpeciesID, now)
		if err != nil {
			return err
		}
		if open {
			return problem.Conflict("upload_open", "another upload of this kind is open")
		}
		return insertUpload(ctx, tx, u)
	})
	if err != nil {
		return nil, err
	}
	if err := createEmpty(path); err != nil {
		_, cleanup := m.deps.DB.ExecContext(ctx, "DELETE FROM data_source_upload WHERE id = ?", u.ID)
		return nil, errors.Join(err, cleanup)
	}
	return web.Created(viewUpload(u, now)), nil
}

func createEmpty(path string) error {
	file, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	return file.Close()
}

// checkCreate applies the rules of the kind to a new upload.
func (m *Module) checkCreate(ctx context.Context, spec KindSpec, body createBody) error {
	if _, ok := spec.extensionOf(body.FileName); !ok {
		return problem.InvalidField("fileName", "extension")
	}
	if body.SpeciesID != nil {
		if !spec.PerSpecies {
			return problem.InvalidField("speciesId", "not_allowed")
		}
		n, err := db.Scalar[int](ctx, m.deps.DB, "SELECT count(*) FROM species WHERE id = ?", *body.SpeciesID)
		if err != nil {
			return err
		}
		if n == 0 {
			return problem.InvalidField("speciesId", "unknown")
		}
	}
	if body.SizeBytes > spec.MaxBytes {
		return problem.New("too_large", http.StatusRequestEntityTooLarge,
			fmt.Sprintf("%d bytes is more than the limit of %d bytes", body.SizeBytes, spec.MaxBytes))
	}
	return nil
}

func (m *Module) checkDisk(dir string, size int64) error {
	free, err := m.free(dir)
	if err != nil {
		return err
	}
	if free < needDisk(size) {
		return problem.New("disk_full", http.StatusInsufficientStorage,
			fmt.Sprintf("%d bytes free, %d bytes necessary", free, needDisk(size)))
	}
	return nil
}

func hashState(h hash.Hash) ([]byte, error) {
	return h.(encoding.BinaryMarshaler).MarshalBinary()
}

// restoreHash continues a SHA-256 from its stored state. A process restart
// thus does not read the received bytes again.
func restoreHash(state []byte) (hash.Hash, error) {
	h := sha256.New()
	if len(state) == 0 {
		return h, nil
	}
	if err := h.(encoding.BinaryUnmarshaler).UnmarshalBinary(state); err != nil {
		return nil, err
	}
	return h, nil
}

func (m *Module) getUpload(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	u, err := getUpload(r.Context(), m.deps.DB, id)
	if err != nil {
		return nil, err
	}
	return web.OK(viewUpload(u, m.now())), nil
}

// usable gives the open session or the problem that stops a write to it.
func (m *Module) usable(ctx context.Context, id db.ID) (upload, error) {
	u, err := getUpload(ctx, m.deps.DB, id)
	if err != nil {
		return u, err
	}
	if u.State == UploadOpen && expired(u, m.now()) {
		if err := m.expire(ctx, u); err != nil {
			return u, err
		}
		u.State = UploadExpired
	}
	if u.State != UploadOpen {
		return u, problem.Conflict("upload_closed", "the upload is "+string(u.State))
	}
	return u, nil
}

func (m *Module) appendUpload(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	if media, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type")); media != "application/octet-stream" {
		return nil, problem.UnsupportedMedia()
	}
	offset, err := strconv.ParseInt(r.Header.Get("Upload-Offset"), 10, 64)
	if err != nil || offset < 0 {
		return nil, problem.InvalidField("Upload-Offset", "int_parsing")
	}
	ctx := r.Context()
	lock := m.lock(id)
	lock.Lock()
	defer lock.Unlock()
	u, err := m.usable(ctx, id)
	if err != nil {
		return nil, err
	}
	if offset != u.ReceivedBytes {
		p := problem.Conflict("offset_mismatch", fmt.Sprintf("the upload has %d bytes", u.ReceivedBytes))
		p.Header = http.Header{"Upload-Offset": {strconv.FormatInt(u.ReceivedBytes, 10)}}
		return nil, p
	}
	written, state, err := m.writePart(u, r.Body)
	if err != nil {
		return nil, err
	}
	u.ReceivedBytes += written
	u.HashState = state
	u.ExpiresAt = db.At(m.now().Add(uploadTTL))
	if _, err := m.deps.DB.ExecContext(ctx, `UPDATE data_source_upload
		SET received_bytes = ?, hash_state = ?, expires_at = ? WHERE id = ?`,
		u.ReceivedBytes, u.HashState, u.ExpiresAt, u.ID); err != nil {
		return nil, err
	}
	header := http.Header{"Upload-Offset": {strconv.FormatInt(u.ReceivedBytes, 10)}}
	return web.JSONWithHeader(http.StatusOK, viewUpload(u, m.now()), header), nil
}

// writePart streams one part to the end of the file and advances the hash.
// The file is cut to the received length first, so bytes of a part that a
// crash interrupted do not stay. On an error the file keeps its old length.
func (m *Module) writePart(u upload, body io.Reader) (int64, []byte, error) {
	limit := min(u.PartSize, u.SizeBytes-u.ReceivedBytes)
	h, err := restoreHash(u.HashState)
	if err != nil {
		return 0, nil, err
	}
	file, err := os.OpenFile(m.files.abs(u.TempPath), os.O_WRONLY, 0)
	if err != nil {
		return 0, nil, err
	}
	defer file.Close()
	if err := file.Truncate(u.ReceivedBytes); err != nil {
		return 0, nil, err
	}
	if _, err := file.Seek(u.ReceivedBytes, io.SeekStart); err != nil {
		return 0, nil, err
	}
	written, err := io.Copy(io.MultiWriter(file, h), io.LimitReader(body, limit+1))
	fail := func(cause error) (int64, []byte, error) {
		return 0, nil, errors.Join(cause, file.Truncate(u.ReceivedBytes))
	}
	switch {
	case err != nil:
		return fail(problem.InvalidField("body", "read"))
	case written > limit && limit == u.PartSize:
		return fail(problem.New("too_large", http.StatusRequestEntityTooLarge,
			fmt.Sprintf("a part has at most %d bytes", u.PartSize)))
	case written > limit:
		return fail(problem.New("too_large", http.StatusRequestEntityTooLarge,
			fmt.Sprintf("the part goes past the size of %d bytes", u.SizeBytes)))
	}
	if err := file.Sync(); err != nil {
		return fail(err)
	}
	state, err := hashState(h)
	if err != nil {
		return fail(err)
	}
	return written, state, nil
}

func (m *Module) abortUpload(r *http.Request) (web.Response, error) {
	id, err := web.PathID(r, "id")
	if err != nil {
		return nil, err
	}
	ctx := r.Context()
	lock := m.lock(id)
	lock.Lock()
	defer lock.Unlock()
	u, err := getUpload(ctx, m.deps.DB, id)
	if err != nil {
		return nil, err
	}
	switch u.State {
	case UploadComplete:
		return nil, problem.Conflict("upload_closed", "the upload is complete")
	case UploadOpen:
		if err := m.close(ctx, u, UploadAborted); err != nil {
			return nil, err
		}
	}
	m.locks.Delete(id)
	return web.Empty(http.StatusNoContent), nil
}

// close ends a session and removes its partial file.
func (m *Module) close(ctx context.Context, u upload, state UploadState) error {
	if _, err := m.deps.DB.ExecContext(ctx, "UPDATE data_source_upload SET state = ? WHERE id = ? AND state = 'open'",
		state, u.ID); err != nil {
		return err
	}
	if err := os.Remove(m.files.abs(u.TempPath)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func (m *Module) expire(ctx context.Context, u upload) error { return m.close(ctx, u, UploadExpired) }

// Sweep ends each open session that waited longer than its time limit. It
// gives the count of ended sessions.
func (m *Module) Sweep(ctx context.Context) (int, error) {
	stale, err := db.All(ctx, m.deps.DB, scanUpload, "SELECT "+uploadCols+
		" FROM data_source_upload WHERE state = 'open' AND expires_at <= ?", m.now())
	if err != nil {
		return 0, err
	}
	for _, u := range stale {
		lock := m.lock(u.ID)
		lock.Lock()
		err := m.expire(ctx, u)
		lock.Unlock()
		m.locks.Delete(u.ID)
		if err != nil {
			return 0, err
		}
	}
	return len(stale), nil
}

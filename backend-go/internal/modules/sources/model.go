package sources

import (
	"context"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

// VersionState is the state of one version of a data source.
type VersionState string

// The states of a version. A new upload goes validating, processing, then
// ready or failed. An activation sets the earlier active version to superseded.
const (
	StateValidating VersionState = "validating"
	StateProcessing VersionState = "processing"
	StateReady      VersionState = "ready"
	StateFailed     VersionState = "failed"
	StateSuperseded VersionState = "superseded"
)

// Origin tells how a version came into the service.
type Origin string

// The origins of a version.
const (
	OriginUpload   Origin = "upload"
	OriginDerived  Origin = "derived"
	OriginTraining Origin = "training"
)

// originalName is the base name of the uploaded file in the version folder.
const originalName = "original"

// Version is one version of a data source. Dir and Log are not stored:
// the service sets them for the processors.
type Version struct {
	ID            db.ID
	Kind          Kind
	Number        int
	Origin        Origin
	DerivedFromID *db.ID
	State         VersionState
	Active        bool
	FileName      *string
	SizeBytes     *int64
	SHA256        *string
	StoragePath   string
	SpeciesID     *db.ID
	Metadata      map[string]any
	ErrorCode     *string
	ErrorDetail   *string
	LogPath       *string
	CreatedByID   *db.ID
	CreatedAt     db.Time
	ProcessedAt   *db.Time
	ActivatedAt   *db.Time
	Artifacts     []Artifact

	// Dir is the absolute folder of the version.
	Dir string
	// Log receives the lines of the processing log.
	Log io.Writer
}

// Original gives the absolute path of the uploaded file, or "" when the
// version has no upload.
func (v *Version) Original() string {
	if v.FileName == nil || v.Origin != OriginUpload {
		return ""
	}
	spec, _ := SpecOf(v.Kind)
	ext, ok := spec.extensionOf(*v.FileName)
	if !ok {
		ext = filepath.Ext(*v.FileName)
	}
	return filepath.Join(v.Dir, originalName+ext)
}

// DerivedDir gives the folder for the files that processing makes.
func (v *Version) DerivedDir() string { return filepath.Join(v.Dir, "derived") }

// Logf writes one line to the processing log.
func (v *Version) Logf(format string, args ...any) {
	if v.Log != nil {
		fmt.Fprintf(v.Log, format+"\n", args...)
	}
}

// Artifact gets the artifact with the name.
func (v *Version) Artifact(name string) (Artifact, bool) {
	i := slices.IndexFunc(v.Artifacts, func(a Artifact) bool { return a.Name == name })
	if i < 0 {
		return Artifact{}, false
	}
	return v.Artifacts[i], true
}

// Artifact is a file or folder that processing made from a version.
// Path is absolute. A Spawn makes the folder a new version of another kind.
type Artifact struct {
	Name      string
	Path      string
	SizeBytes int64
	SHA256    *string
	Spawn     *Spawn
}

// Spawn asks the service to install an artifact folder as a new version,
// for example the bundle of one species from a model-bundle archive.
type Spawn struct {
	Kind      Kind
	SpeciesID db.ID
}

// Processor checks and processes the versions of one kind.
// Validate gives the metadata of the report. Derive gives the artifacts.
type Processor interface {
	Validate(ctx context.Context, v *Version) (map[string]any, error)
	Derive(ctx context.Context, v *Version) ([]Artifact, error)
}

// Failure is an error with a code for the version report.
type Failure struct {
	Code   string
	Detail string
}

func (f *Failure) Error() string { return f.Code + ": " + f.Detail }

// Fail makes a Failure with a formatted detail.
func Fail(code, format string, args ...any) error {
	return &Failure{Code: code, Detail: fmt.Sprintf(format, args...)}
}

// failureOf gives the code and the detail of an error. An error without a
// code gets the fallback code.
func failureOf(err error, fallback string) (string, string) {
	var f *Failure
	if errors.As(err, &f) {
		return f.Code, f.Detail
	}
	return fallback, err.Error()
}

// UploadState is the state of an upload session.
type UploadState string

// The states of an upload session.
const (
	UploadOpen     UploadState = "open"
	UploadComplete UploadState = "complete"
	UploadAborted  UploadState = "aborted"
	UploadExpired  UploadState = "expired"
)

// upload is one row of data_source_upload.
type upload struct {
	ID             db.ID
	Kind           Kind
	SpeciesID      *db.ID
	FileName       string
	SizeBytes      int64
	ExpectedSHA256 *string
	ReceivedBytes  int64
	PartSize       int64
	HashState      []byte
	TempPath       string
	Activate       bool
	State          UploadState
	VersionID      *db.ID
	CreatedByID    *db.ID
	CreatedAt      db.Time
	ExpiresAt      db.Time
}

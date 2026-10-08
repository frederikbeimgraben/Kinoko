package derive

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"slices"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/gbif"
)

// GBIFArchive processes a GBIF download zip into one slim JSON-Lines file
// per year under gbif.ArchiveDir of the version folder.
type GBIFArchive struct {
	// Options sets the filter of the import; zero values take the defaults.
	Options gbif.ImportOptions
}

// Validate imports the archive. The import is the check: it reads each
// row, and the files appear only when the whole archive is valid. The
// metadata is the ImportMeta of the import.
func (p GBIFArchive) Validate(ctx context.Context, v *sources.Version) (map[string]any, error) {
	opt := p.Options
	opt.Log = v.Logf
	meta, err := gbif.ImportArchive(ctx, v.Original(), gbif.ArchiveDir(v.Dir), opt)
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, sources.Fail("invalid", "%v", err)
	}
	return metaMap(meta)
}

// Derive names each year file as an artifact "gbif/<file>".
func (GBIFArchive) Derive(_ context.Context, v *sources.Version) ([]sources.Artifact, error) {
	dir := gbif.ArchiveDir(v.Dir)
	files, err := filepath.Glob(filepath.Join(dir, "*.jsonl.gz"))
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, sources.Fail("derive_failed", "the import wrote no year file")
	}
	out := make([]sources.Artifact, 0, len(files))
	for _, f := range slices.Sorted(slices.Values(files)) {
		info, err := os.Stat(f)
		if err != nil {
			return nil, err
		}
		out = append(out, sources.Artifact{Name: "gbif/" + filepath.Base(f), Path: f, SizeBytes: info.Size()})
	}
	return out, nil
}

// metaMap turns the import report into version metadata with its JSON keys.
func metaMap(meta gbif.ImportMeta) (map[string]any, error) {
	raw, err := json.Marshal(meta)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	return out, json.Unmarshal(raw, &out)
}

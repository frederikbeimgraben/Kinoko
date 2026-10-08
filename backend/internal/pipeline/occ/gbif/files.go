package gbif

import (
	"bufio"
	"compress/gzip"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// CacheDir gives the folder of the API cache under the data folder PILZE_DATA.
func CacheDir(dataDir string) string { return filepath.Join(dataDir, "cache", "gbif") }

// ArchiveDir gives the folder of the files that ImportArchive derives from a gbif-archive version folder.
func ArchiveDir(versionDir string) string { return filepath.Join(versionDir, "derived", "gbif") }

// PartialSuffix ends the name of a chunk file that is not complete.
const PartialSuffix = ".partial"

// ChunkName gives the cache file name of a year (month 0) or of one month of a year:
// fungi_de_2026.jsonl.gz or fungi_de_2026-05.jsonl.gz.
func ChunkName(country string, year, month int) string {
	if month == 0 {
		return fmt.Sprintf("fungi_%s_%d.jsonl.gz", strings.ToLower(country), year)
	}
	return fmt.Sprintf("fungi_%s_%d-%02d.jsonl.gz", strings.ToLower(country), year, month)
}

var chunkPattern = regexp.MustCompile(`^fungi_([a-z]+)_(\d{4})(?:-(\d{2}))?\.jsonl\.gz$`)

// ParseChunkName reads the country, year and month (0 for a year file) of a chunk file name.
func ParseChunkName(name string) (country string, year, month int, ok bool) {
	m := chunkPattern.FindStringSubmatch(name)
	if m == nil {
		return "", 0, 0, false
	}
	year, _ = strconv.Atoi(m[2])
	if m[3] != "" {
		month, _ = strconv.Atoi(m[3])
	}
	return m[1], year, month, true
}

// DoneName gives the name of the empty marker file that tells that the fetch
// of a year ended without an error, for example fungi_de_2026.done.
func DoneName(country string, year int) string {
	return fmt.Sprintf("fungi_%s_%d.done", strings.ToLower(country), year)
}

// YearFiles gives the chunk files of one country and year in dir, sorted by name.
func YearFiles(dir, country string, year int) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	var out []string
	for _, e := range entries {
		c, y, _, ok := ParseChunkName(e.Name())
		if ok && !e.IsDir() && y == year && c == strings.ToLower(country) {
			out = append(out, filepath.Join(dir, e.Name()))
		}
	}
	return out, nil
}

// chunkWriter writes slim lines into a gzip file with the partial suffix.
// Commit renames it to its final name. Abort removes it.
type chunkWriter struct {
	path    string
	file    *os.File
	buf     *bufio.Writer
	gz      *gzip.Writer
	records int
}

func newChunkWriter(path string) (*chunkWriter, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	f, err := os.Create(path + PartialSuffix)
	if err != nil {
		return nil, err
	}
	buf := bufio.NewWriterSize(f, 1<<16)
	return &chunkWriter{path: path, file: f, buf: buf, gz: gzip.NewWriter(buf)}, nil
}

func (w *chunkWriter) write(line []byte) error {
	w.records++
	_, err := w.gz.Write(line)
	return err
}

// finish closes the partial file and keeps it for a later commit.
func (w *chunkWriter) finish() error {
	if err := w.gz.Close(); err != nil {
		return errors.Join(err, w.file.Close())
	}
	if err := w.buf.Flush(); err != nil {
		return errors.Join(err, w.file.Close())
	}
	if err := w.file.Sync(); err != nil {
		return errors.Join(err, w.file.Close())
	}
	return w.file.Close()
}

func (w *chunkWriter) commit() error { return os.Rename(w.path+PartialSuffix, w.path) }

func (w *chunkWriter) abort() {
	// abort only cleans up after a failure, so a second error adds nothing.
	_ = w.file.Close()
	_ = os.Remove(w.path + PartialSuffix)
}

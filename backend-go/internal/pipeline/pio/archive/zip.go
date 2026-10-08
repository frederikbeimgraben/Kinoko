// Package archive reads upload archives as streams: zip files, tab-separated
// text, and GBIF downloads in the DwC-A and SIMPLE_CSV formats.
package archive

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
)

// Zip is an open zip file. It reads each entry as a stream and does not unpack the file.
type Zip struct {
	path string
	rc   *zip.ReadCloser
}

// Entry is a regular file in a zip.
type Entry struct {
	Name string
	Size int64
}

// OpenZip opens a zip file to read.
func OpenZip(p string) (*Zip, error) {
	rc, err := zip.OpenReader(p)
	if err != nil {
		return nil, fmt.Errorf("archive: open %s: %w", p, err)
	}
	return &Zip{path: p, rc: rc}, nil
}

// Close closes the zip file.
func (z *Zip) Close() error { return z.rc.Close() }

// Entries gives the regular files of the zip in archive order.
func (z *Zip) Entries() []Entry {
	out := make([]Entry, 0, len(z.rc.File))
	for _, f := range z.rc.File {
		if !f.FileInfo().IsDir() {
			out = append(out, Entry{Name: f.Name, Size: int64(f.UncompressedSize64)})
		}
	}
	return out
}

// Find gives the names of the regular files for which keep is true.
func (z *Zip) Find(keep func(name string) bool) []string {
	var out []string
	for _, e := range z.Entries() {
		if keep(e.Name) {
			out = append(out, e.Name)
		}
	}
	return out
}

// Open gives a stream of the uncompressed content of the named entry.
func (z *Zip) Open(name string) (io.ReadCloser, error) {
	for _, f := range z.rc.File {
		if f.Name == name {
			r, err := f.Open()
			if err != nil {
				return nil, fmt.Errorf("archive: %s: %s: %w", z.path, name, err)
			}
			return r, nil
		}
	}
	return nil, fmt.Errorf("archive: %s: entry %q: %w", z.path, name, os.ErrNotExist)
}

// ErrUnsafePath tells that a zip entry name points out of the target directory.
var ErrUnsafePath = errors.New("archive: unsafe entry path")

// ExtractZip writes the regular files of the zip for which keep is true into dir.
// It refuses absolute names and names with "..", so an entry cannot write out of dir.
// It gives the written paths in archive order.
func ExtractZip(zipPath, dir string, keep func(name string) bool) ([]string, error) {
	z, err := OpenZip(zipPath)
	if err != nil {
		return nil, err
	}
	defer z.Close()
	var written []string
	for _, f := range z.rc.File {
		if f.FileInfo().IsDir() || !keep(f.Name) {
			continue
		}
		target, err := safeTarget(dir, f.Name)
		if err != nil {
			return written, err
		}
		if err := extractOne(f, target); err != nil {
			return written, fmt.Errorf("archive: %s: %s: %w", zipPath, f.Name, err)
		}
		written = append(written, target)
	}
	return written, nil
}

// safeTarget joins dir and an entry name. It refuses a name that leaves dir.
func safeTarget(dir, name string) (string, error) {
	clean := path.Clean(strings.ReplaceAll(name, `\`, "/"))
	if path.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, "../") ||
		slices.Contains(strings.Split(clean, "/"), "..") || filepath.VolumeName(clean) != "" {
		return "", fmt.Errorf("%w: %q", ErrUnsafePath, name)
	}
	return filepath.Join(dir, filepath.FromSlash(clean)), nil
}

func extractOne(f *zip.File, target string) (err error) {
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	r, err := f.Open()
	if err != nil {
		return err
	}
	defer r.Close()
	tmp := target + ".partial"
	out, err := os.Create(tmp)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			out.Close()
			os.Remove(tmp)
		}
	}()
	if _, err = io.Copy(out, r); err != nil {
		return err
	}
	if err = out.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, target)
}

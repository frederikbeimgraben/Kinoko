package sources

import (
	"archive/zip"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

func openZip(file string) (*zip.ReadCloser, error) {
	z, err := zip.OpenReader(file)
	if err != nil {
		return nil, Fail("zip", "the file is not a readable zip archive: %v", err)
	}
	return z, nil
}

// entryName gives the clean name of a zip entry. A name that leaves the
// target folder is refused, so an archive cannot write outside it.
func entryName(f *zip.File) (string, error) {
	name := f.Name
	clean := path.Clean(strings.TrimPrefix(name, "./"))
	if strings.Contains(name, `\`) || path.IsAbs(name) || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", Fail("zip", "the entry %q has an unsafe path", name)
	}
	return clean, nil
}

// zipFiles gives the regular file entries with their clean names. Folders and
// the metadata of macOS archives are left out.
func zipFiles(z *zip.ReadCloser) (map[string]*zip.File, error) {
	out := map[string]*zip.File{}
	for _, f := range z.File {
		if f.FileInfo().IsDir() {
			continue
		}
		name, err := entryName(f)
		if err != nil {
			return nil, err
		}
		if strings.HasPrefix(name, "__MACOSX/") || path.Base(name) == ".DS_Store" {
			continue
		}
		out[name] = f
	}
	return out, nil
}

// extract writes one entry to the target file.
func extract(f *zip.File, target string) error {
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	in, err := f.Open()
	if err != nil {
		return Fail("zip", "the entry %q cannot be read: %v", f.Name, err)
	}
	defer in.Close()
	out, err := os.Create(target)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return Fail("zip", "the entry %q cannot be read: %v", f.Name, err)
	}
	return out.Close()
}

// readEntry reads at most limit bytes of an entry.
func readEntry(f *zip.File, limit int64) ([]byte, error) {
	in, err := f.Open()
	if err != nil {
		return nil, Fail("zip", "the entry %q cannot be read: %v", f.Name, err)
	}
	defer in.Close()
	data, err := io.ReadAll(io.LimitReader(in, limit))
	if err != nil {
		return nil, Fail("zip", "the entry %q cannot be read: %v", f.Name, err)
	}
	return data, nil
}

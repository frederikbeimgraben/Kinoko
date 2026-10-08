package pyjson

import (
	"os"
	"path/filepath"
)

// WriteManifest writes MarshalManifest(v) to path, as manifest.schreibe.
// A reader sees the old file or the new file, never a part.
func WriteManifest(path string, v any) error {
	return WriteFileAtomic(path, MarshalManifest(v))
}

// WriteFileAtomic writes data to a temporary file in the folder of path and
// renames it to path. The file gets mode 0644.
func WriteFileAtomic(path string, data []byte) (err error) {
	tmp, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = os.Remove(tmp.Name())
		}
	}()
	if _, err = tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err = tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	if err = os.Chmod(tmp.Name(), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

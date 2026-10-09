package importer

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io/fs"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

// fileDigest gives the SHA-256 digest of a seed file. The bool is false when the file is absent.
func fileDigest(data fs.FS, name string) (string, bool, error) {
	body, err := fs.ReadFile(data, name)
	if errors.Is(err, fs.ErrNotExist) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:]), true, nil
}

// saveDigest records the digest of a seed file after its import.
func saveDigest(ctx context.Context, q db.Querier, data fs.FS, name string) error {
	digest, found, err := fileDigest(data, name)
	if err != nil || !found {
		return err
	}
	_, err = db.Exec(ctx, q, `INSERT INTO seed_digest (name, digest) VALUES (?, ?)
		ON CONFLICT (name) DO UPDATE SET digest = excluded.digest`, name, digest)
	return err
}

// reactionSeedChanged tells if daten/reaktionen.json differs from the file of the last sync.
func reactionSeedChanged(ctx context.Context, q db.Querier, data fs.FS) (bool, error) {
	digest, found, err := fileDigest(data, ReactionsFile)
	if err != nil || !found {
		return false, err
	}
	stored, known, err := db.Maybe(ctx, q, func(s db.Scanner) (string, error) {
		var value string
		return value, s.Scan(&value)
	}, "SELECT digest FROM seed_digest WHERE name = ?", ReactionsFile)
	if err != nil {
		return false, err
	}
	return !known || stored != digest, nil
}

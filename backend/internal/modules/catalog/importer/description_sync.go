package importer

import (
	"context"
	"database/sql"
	"io/fs"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// speciesFile gives the seed file name of a profile stem.
func speciesFile(stem string) string { return "arten/" + stem + ".toml" }

// SyncDescriptions writes the description fields of each species file that changed
// since its last import into the species with the same slug. A file without
// beschreibung keeps the description of the database. The other fields of a
// species stay as they are, because the admin UI can change them.
// It records the digest of each file and gives the count of changed species.
func SyncDescriptions(ctx context.Context, handle *sql.DB, data fs.FS, profiles []StemProfile, now db.Time) (int, error) {
	return db.InTxValue(ctx, handle, func(tx *sql.Tx) (int, error) {
		stored, err := storedDigests(ctx, tx)
		if err != nil {
			return 0, err
		}
		changed := 0
		for _, p := range profiles {
			name := speciesFile(p.Stem)
			digest, found, err := fileDigest(data, name)
			if err != nil {
				return 0, err
			}
			if !found || stored[name] == digest {
				continue
			}
			if p.Profile.Beschreibung != nil {
				n, err := writeDescription(ctx, tx, p.Profile, now)
				if err != nil {
					return 0, err
				}
				changed += int(n)
			}
			if err := storeDigest(ctx, tx, name, digest); err != nil {
				return 0, err
			}
		}
		return changed, nil
	})
}

// writeDescription sets the description fields of the species of a profile. It changes
// the row, and with it the time of the last change, only when a value differs.
func writeDescription(ctx context.Context, tx *sql.Tx, p Profile, now db.Time) (int64, error) {
	english := fn.Deref(p.BeschreibungEn, "")
	return db.Exec(ctx, tx, `UPDATE species SET description = ?, description_en = ?, description_draft = ?,
		updated_at = ? WHERE slug = ? AND (description IS NOT ? OR description_en IS NOT ? OR description_draft IS NOT ?)`,
		p.Beschreibung, english, p.Entwurf, now, Slugify(p.Lateinisch), p.Beschreibung, english, p.Entwurf)
}

// saveSpeciesDigests records the digest of each species file after a full import.
func saveSpeciesDigests(ctx context.Context, q db.Querier, data fs.FS, profiles []StemProfile) error {
	for _, p := range profiles {
		if err := saveDigest(ctx, q, data, speciesFile(p.Stem)); err != nil {
			return err
		}
	}
	return nil
}

func storedDigests(ctx context.Context, q db.Querier) (map[string]string, error) {
	type entry struct{ name, digest string }
	rows, err := db.All(ctx, q, func(s db.Scanner) (entry, error) {
		var e entry
		return e, s.Scan(&e.name, &e.digest)
	}, "SELECT name, digest FROM seed_digest")
	if err != nil {
		return nil, err
	}
	return fn.ToMap(rows, func(e entry) (string, string) { return e.name, e.digest }), nil
}

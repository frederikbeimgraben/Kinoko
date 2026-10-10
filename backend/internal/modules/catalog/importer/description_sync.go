package importer

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// descriptionKey names the seed digest of the description fields of a species file.
func descriptionKey(stem string) string { return "arten/" + stem + ".toml#beschreibung" }

// description holds the description fields of a species, as in the file or in the database.
type description struct {
	german  *string
	english string
	draft   bool
}

func (d description) digest() string {
	german := "\x01"
	if d.german != nil {
		german = *d.german
	}
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s\x00%s\x00%t", german, d.english, d.draft)))
	return hex.EncodeToString(sum[:])
}

func (d description) empty() bool { return (d.german == nil || *d.german == "") && d.english == "" }

func fileDescription(p Profile) description {
	return description{p.Beschreibung, fn.Deref(p.BeschreibungEn, ""), p.Entwurf}
}

// SyncDescriptions writes the description fields of a species file into the species with
// the same slug when the file fields changed since the last sync and nobody changed the
// database fields since then. Without a stored digest, it fills only an empty description.
func SyncDescriptions(ctx context.Context, handle *sql.DB, profiles []StemProfile, now db.Time) (int, error) {
	return db.InTxValue(ctx, handle, func(tx *sql.Tx) (int, error) {
		stored, err := storedDigests(ctx, tx)
		if err != nil {
			return 0, err
		}
		changed := 0
		for _, p := range profiles {
			key, file := descriptionKey(p.Stem), fileDescription(p.Profile)
			last, known := stored[key]
			if known && last == file.digest() {
				continue
			}
			// A file without beschreibung keeps the description and the digest of the last sync.
			if p.Profile.Beschreibung == nil {
				continue
			}
			n, err := syncOne(ctx, tx, p.Profile, last, known, now)
			if err != nil {
				return 0, err
			}
			changed += int(n)
			if err := storeDigest(ctx, tx, key, file.digest()); err != nil {
				return 0, err
			}
		}
		return changed, nil
	})
}

// syncOne writes the file description when the database still holds the last synced
// fields, or when no sync occurred and the database has no description.
func syncOne(ctx context.Context, tx *sql.Tx, p Profile, last string, known bool, now db.Time) (int64, error) {
	current, found, err := db.Maybe(ctx, tx, func(s db.Scanner) (description, error) {
		var d description
		return d, s.Scan(&d.german, &d.english, &d.draft)
	}, "SELECT description, description_en, description_draft FROM species WHERE slug = ?", Slugify(p.Lateinisch))
	if err != nil || !found {
		return 0, err
	}
	if (known && current.digest() != last) || (!known && !current.empty()) {
		return 0, nil
	}
	return writeDescription(ctx, tx, p, now)
}

// writeDescription sets the description fields of the species of a profile. It changes
// the row, and with it the time of the last change, only when a value differs.
func writeDescription(ctx context.Context, tx *sql.Tx, p Profile, now db.Time) (int64, error) {
	english := fn.Deref(p.BeschreibungEn, "")
	return db.Exec(ctx, tx, `UPDATE species SET description = ?, description_en = ?, description_draft = ?,
		updated_at = ? WHERE slug = ? AND (description IS NOT ? OR description_en IS NOT ? OR description_draft IS NOT ?)`,
		p.Beschreibung, english, p.Entwurf, now, Slugify(p.Lateinisch), p.Beschreibung, english, p.Entwurf)
}

// saveSpeciesDigests records the description digest and the field values of each species file after a full import.
func saveSpeciesDigests(ctx context.Context, q db.Querier, profiles []StemProfile) error {
	for _, p := range profiles {
		if err := storeDigest(ctx, q, descriptionKey(p.Stem), fileDescription(p.Profile).digest()); err != nil {
			return err
		}
	}
	return saveFieldDigests(ctx, q, profiles)
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

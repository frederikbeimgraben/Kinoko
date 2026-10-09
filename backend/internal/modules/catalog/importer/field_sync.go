package importer

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

// seedField is one species field that a running instance takes from the seed files.
// The value nil is the empty value: no forecast, no ring shape.
type seedField struct {
	key   string
	read  string
	write string
	value func(Profile) *string
}

var (
	on            = "true"
	seedFields    = []seedField{forecastField, ringField}
	forecastField = seedField{
		key:   "karte",
		read:  "CASE WHEN forecast_enabled THEN 'true' END",
		write: "forecast_enabled = ? IS NOT NULL",
		value: func(p Profile) *string {
			if p.Karte == nil {
				return nil
			}
			return &on
		},
	}
	ringField = seedField{
		key:   "ringform",
		read:  "ring_shape",
		write: "ring_shape = ?",
		value: func(p Profile) *string {
			if p.Ringform == nil {
				return nil
			}
			if shape, ok := RingShape[*p.Ringform]; ok {
				return &shape
			}
			return nil
		},
	}
)

func (f seedField) digestKey(stem string) string { return "arten/" + stem + ".toml#" + f.key }

func valueDigest(v *string) string {
	if v == nil {
		return "\x01"
	}
	return *v
}

// SyncFields sets the forecast flag and the ring shape of a species to the values of its
// file when the file changed a value since the last sync and nobody changed the field since
// then. Without a stored value, it only fills an empty field, so a value of an admin stays.
func SyncFields(ctx context.Context, handle *sql.DB, profiles []StemProfile, now db.Time) (int, error) {
	return db.InTxValue(ctx, handle, func(tx *sql.Tx) (int, error) {
		stored, err := storedDigests(ctx, tx)
		if err != nil {
			return 0, err
		}
		changed := 0
		for _, p := range profiles {
			for _, f := range seedFields {
				n, err := f.sync(ctx, tx, p, stored, now)
				if err != nil {
					return 0, err
				}
				changed += n
			}
		}
		return changed, nil
	})
}

func (f seedField) sync(ctx context.Context, tx *sql.Tx, p StemProfile, stored map[string]string, now db.Time) (int, error) {
	key, file := f.digestKey(p.Stem), f.value(p.Profile)
	last, known := stored[key]
	if known && last == valueDigest(file) {
		return 0, nil
	}
	slug := Slugify(p.Profile.Lateinisch)
	current, found, err := db.Maybe(ctx, tx, func(s db.Scanner) (*string, error) {
		var v *string
		return v, s.Scan(&v)
	}, fmt.Sprintf("SELECT %s FROM species WHERE slug = ?", f.read), slug)
	if err != nil {
		return 0, err
	}
	untouched := (known && valueDigest(current) == last) || (!known && current == nil)
	written := 0
	if found && valueDigest(current) != valueDigest(file) && untouched {
		if _, err := db.Exec(ctx, tx, fmt.Sprintf("UPDATE species SET %s, updated_at = ? WHERE slug = ?", f.write),
			file, now, slug); err != nil {
			return 0, err
		}
		written = 1
	}
	return written, storeDigest(ctx, tx, key, valueDigest(file))
}

// saveFieldDigests records the seed values of each species file after a full import.
func saveFieldDigests(ctx context.Context, q db.Querier, profiles []StemProfile) error {
	for _, p := range profiles {
		for _, f := range seedFields {
			if err := storeDigest(ctx, q, f.digestKey(p.Stem), valueDigest(f.value(p.Profile))); err != nil {
				return err
			}
		}
	}
	return nil
}

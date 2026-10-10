package importer

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

// seedField is one species field that a running instance takes from the seed files.
// The value nil is the empty value: no forecast, no ring shape. fresh is the condition
// for a write on the first sync, when no value of an earlier sync is known.
type seedField struct {
	key   string
	read  string
	write string
	fresh string
	value func(Profile) (*string, error)
}

var (
	on            = "true"
	seedFields    = []seedField{forecastField, ringField}
	forecastField = seedField{
		key:   "karte",
		read:  "CASE WHEN forecast_enabled THEN 'true' END",
		write: "forecast_enabled = ? IS NOT NULL",
		// A species with a chain row had a forecast before, so an admin can have turned it off.
		fresh: "updated_by_id IS NULL AND NOT EXISTS (SELECT 1 FROM species_forecast f WHERE f.species_id = species.id)",
		value: func(p Profile) (*string, error) {
			if p.Karte == nil {
				return nil, nil
			}
			return &on, nil
		},
	}
	ringField = seedField{
		key:   "ringform",
		read:  "ring_shape",
		write: "ring_shape = ?",
		fresh: "TRUE",
		value: func(p Profile) (*string, error) {
			if p.Ringform == nil {
				return nil, nil
			}
			if shape, ok := RingShape[*p.Ringform]; ok {
				return &shape, nil
			}
			return nil, fmt.Errorf("unknown ringform %q", *p.Ringform)
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
// then. Without a stored value, it only fills an empty field that the fresh condition allows.
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
	file, err := f.value(p.Profile)
	if err != nil {
		// A bad value changes nothing and stores no digest, so a corrected file syncs later.
		slog.Warn("seed field skipped", "file", p.Stem, "field", f.key, "error", err)
		return 0, nil
	}
	key := f.digestKey(p.Stem)
	last, known := stored[key]
	if known && last == valueDigest(file) {
		return 0, nil
	}
	slug := Slugify(p.Profile.Lateinisch)
	type state struct {
		value *string
		fresh bool
	}
	current, found, err := db.Maybe(ctx, tx, func(s db.Scanner) (state, error) {
		var st state
		return st, s.Scan(&st.value, &st.fresh)
	}, fmt.Sprintf("SELECT %s, %s FROM species WHERE slug = ?", f.read, f.fresh), slug)
	if err != nil {
		return 0, err
	}
	untouched := (known && valueDigest(current.value) == last) || (!known && current.value == nil && current.fresh)
	written := 0
	if found && valueDigest(current.value) != valueDigest(file) && untouched {
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
			value, err := f.value(p.Profile)
			if err != nil {
				continue
			}
			if err := storeDigest(ctx, q, f.digestKey(p.Stem), valueDigest(value)); err != nil {
				return err
			}
		}
	}
	return nil
}

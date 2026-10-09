package importer

import (
	"context"
	"database/sql"
	"strconv"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

// forecastKey names the seed digest of the forecast flag (karte) of a species file.
func forecastKey(stem string) string { return "arten/" + stem + ".toml#karte" }

func forecastOf(p Profile) bool { return p.Karte != nil }

// SyncForecasts sets the forecast flag of a species to the karte of its file when the file
// changed it since the last sync and nobody changed the flag since then. Without a stored
// value, it only turns the forecast on, so a flag that an admin turned on stays.
func SyncForecasts(ctx context.Context, handle *sql.DB, profiles []StemProfile, now db.Time) (int, error) {
	return db.InTxValue(ctx, handle, func(tx *sql.Tx) (int, error) {
		stored, err := storedDigests(ctx, tx)
		if err != nil {
			return 0, err
		}
		changed := 0
		for _, p := range profiles {
			key, file := forecastKey(p.Stem), forecastOf(p.Profile)
			last, known := stored[key]
			if known && last == strconv.FormatBool(file) {
				continue
			}
			slug := Slugify(p.Profile.Lateinisch)
			current, found, err := db.Maybe(ctx, tx, func(s db.Scanner) (bool, error) {
				var on bool
				return on, s.Scan(&on)
			}, "SELECT forecast_enabled FROM species WHERE slug = ?", slug)
			if err != nil {
				return 0, err
			}
			untouched := (known && strconv.FormatBool(current) == last) || (!known && file)
			if found && current != file && untouched {
				if _, err := db.Exec(ctx, tx, "UPDATE species SET forecast_enabled = ?, updated_at = ? WHERE slug = ?",
					file, now, slug); err != nil {
					return 0, err
				}
				changed++
			}
			if err := storeDigest(ctx, tx, key, strconv.FormatBool(file)); err != nil {
				return 0, err
			}
		}
		return changed, nil
	})
}

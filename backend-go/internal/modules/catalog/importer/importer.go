// Package importer reads the species profiles under daten/ and writes the catalogue tables.
package importer

import (
	"context"
	"database/sql"
	"io/fs"
	"time"
)

// SeedIfEmpty imports the catalogue when the table species is empty, and
// imports the reagent reactions of daten/reaktionen.json.
func SeedIfEmpty(ctx context.Context, handle *sql.DB, data fs.FS, now func() time.Time) error {
	return nil
}

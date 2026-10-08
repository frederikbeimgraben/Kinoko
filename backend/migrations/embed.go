// Package migrations holds the SQL files that build the database schema.
// File names are "<number>_<name>.sql". The numbers give the order.
package migrations

import "embed"

// Files are the migration files.
//
//go:embed *.sql
var Files embed.FS

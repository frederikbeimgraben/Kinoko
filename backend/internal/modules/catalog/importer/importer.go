// Package importer reads the species profiles under daten/ and writes the catalogue tables.
package importer

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

// SeedIfEmpty imports the catalogue when the table species is empty, and
// imports the reagent reactions of daten/reaktionen.json.
func SeedIfEmpty(ctx context.Context, handle *sql.DB, data fs.FS, now func() time.Time) error {
	if now == nil {
		now = time.Now
	}
	profiles, err := LoadProfiles(data)
	if err != nil {
		return err
	}
	total, err := db.Scalar[int](ctx, handle, "SELECT count(*) FROM species")
	if err != nil {
		return err
	}
	if total == 0 {
		report, err := ImportAll(ctx, handle, profiles, data, now)
		if err != nil {
			return err
		}
		slog.Info("catalogue import", "species", report.Counts["species"], "taxa", report.Counts["taxa"],
			"terms", report.Counts["terms"], "skipped", report.Skipped)
	}
	reactions, err := SyncReactions(ctx, handle, data, profiles)
	if err != nil {
		return err
	}
	logReactions(reactions)
	return nil
}

func logReactions(r ReactionReport) {
	slog.Info("reaction sync", "species", r.Species, "reactions", r.Reactions, "sources", r.Sources,
		"newTerms", r.NewTerms, "unmatched", len(r.Unmatched), "unknownReagents", r.UnknownReagent)
	if len(r.Unmatched) > 0 {
		slog.Debug("reaction sync without species", "latin", r.Unmatched)
	}
}

// Run is the command "kinoko import-catalog". It migrates the database,
// replaces the catalogue, syncs the reactions and writes the report to out.
func Run(ctx context.Context, handle *sql.DB, data fs.FS, now func() time.Time, out io.Writer) error {
	if now == nil {
		now = time.Now
	}
	if _, err := fmt.Fprintln(out, "Warning: the import deletes all species, terms and taxa. The photos and runs of the species are lost, and the finds lose their species."); err != nil {
		return err
	}
	if err := db.Migrate(ctx, handle); err != nil {
		return err
	}
	profiles, err := LoadProfiles(data)
	if err != nil {
		return err
	}
	report, err := ImportAll(ctx, handle, profiles, data, now)
	if err != nil {
		return err
	}
	reactions, err := SyncReactions(ctx, handle, data, profiles)
	if err != nil {
		return err
	}
	summary := fmt.Sprintf("reactions: %d on %d species, without species: %d", reactions.Reactions, reactions.Species, len(reactions.Unmatched))
	_, err = fmt.Fprintln(out, strings.Join(slices.Concat(ReportLines(report), []string{summary}), "\n"))
	return err
}

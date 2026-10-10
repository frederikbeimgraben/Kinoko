// Command kinoko runs the Kinoko service: the API and the data pipeline.
package main

import (
	"context"
	"database/sql"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	backend "github.com/frederikbeimgraben/kinoko/backend"
	"github.com/frederikbeimgraben/kinoko/backend/internal/app"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/config"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/exporter"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/photos/photoseed"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		slog.Error("kinoko stopped", "error", err)
		os.Exit(1)
	}
}

func run(args []string) (err error) {
	command := "serve"
	if len(args) > 0 {
		command = args[0]
	}
	// The version needs no settings and no database. deploy/backend.sh runs it on the build host.
	if command == "version" {
		fmt.Println(config.Version())
		return nil
	}
	settings, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	handle, err := db.Open(settings.DB)
	if err != nil {
		return err
	}
	defer func() { err = errors.Join(err, handle.Close()) }()
	switch command {
	case "migrate":
		return db.Migrate(ctx, handle)
	case "serve":
		service, err := app.Build(ctx, settings, handle, app.Options{})
		if err != nil {
			return err
		}
		return serve(ctx, settings.Listen, service.Handler)
	case "import-catalog":
		data := os.DirFS(settings.DataDir)
		if settings.DataDir == "" {
			if data, err = fs.Sub(backend.Data, "daten"); err != nil {
				return err
			}
		}
		return importer.Run(ctx, handle, data, time.Now, os.Stdout)
	case "export-catalog":
		return exportCatalog(ctx, handle, args[1:])
	case "seed-photos":
		return seedPhotos(ctx, handle, settings, args[1:])
	default:
		return fmt.Errorf("unknown command %q; use serve, migrate, import-catalog, export-catalog, seed-photos or version", command)
	}
}

// exportCatalog writes the catalogue into the seed files of --out. The keys that the database
// does not hold come from the files in --out, else from the embedded seed.
func exportCatalog(ctx context.Context, handle *sql.DB, args []string) error {
	flags := flag.NewFlagSet("export-catalog", flag.ContinueOnError)
	out := flags.String("out", filepath.Join("backend", "daten"), "folder of the seed files")
	if err := flags.Parse(args); err != nil {
		return err
	}
	base, err := fs.Sub(backend.Data, "daten")
	if err != nil {
		return err
	}
	if info, err := os.Stat(filepath.Join(*out, "arten")); err == nil && info.IsDir() {
		base = os.DirFS(*out)
	}
	return exporter.Run(ctx, handle, base, *out, os.Stdout)
}

// seedPhotos downloads the photos of daten/fotos.json into the photo folder.
func seedPhotos(ctx context.Context, handle *sql.DB, settings config.Settings, args []string) error {
	flags := flag.NewFlagSet("seed-photos", flag.ContinueOnError)
	file := flags.String("file", "", "seed file of the photos")
	pause := flags.Duration("pause", 2*time.Second, "pause between two downloads")
	if err := flags.Parse(args); err != nil {
		return err
	}
	entries, err := photoEntries(settings, *file)
	if err != nil {
		return err
	}
	report, err := photoseed.Run(ctx, handle, entries, photoseed.Options{
		Photos: settings.Photos, MaxBytes: settings.MaxPhotoBytes, Pause: *pause, Out: os.Stdout,
	})
	if err != nil {
		return err
	}
	fmt.Printf("photos: %d added, %d lead photos, %d present, %d failed, %d invalid\n",
		report.Added, report.Lead, report.Skipped, len(report.Failed), len(report.Invalid))
	if len(report.Invalid) > 0 {
		fmt.Printf("warning: a new run cannot add these entries; correct the seed file or the species: %s\n",
			strings.Join(report.Invalid, ", "))
	}
	if len(report.Failed) > 0 {
		return fmt.Errorf("%d photos failed: %s; run the command again", len(report.Failed),
			strings.Join(report.Failed, ", "))
	}
	return nil
}

// photoEntries reads the photo seed file: --file, else fotos.json of the data folder of the
// settings, else the embedded seed.
func photoEntries(settings config.Settings, file string) (map[string]photoseed.Entry, error) {
	if file != "" {
		raw, err := os.ReadFile(file)
		if err != nil {
			return nil, err
		}
		return photoseed.Parse(raw)
	}
	if settings.DataDir != "" {
		return photoseed.Load(os.DirFS(settings.DataDir))
	}
	data, err := fs.Sub(backend.Data, "daten")
	if err != nil {
		return nil, err
	}
	return photoseed.Load(data)
}

func serve(ctx context.Context, listen string, handler http.Handler) error {
	srv := &http.Server{
		Addr:              listen,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	failed := make(chan error, 1)
	go func() { failed <- srv.ListenAndServe() }()
	slog.Info("kinoko listens", "address", listen, "version", config.Version())
	select {
	case err := <-failed:
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdown); err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
}

// Command gbifcount counts the GBIF records that the forecast can train on, for
// each species file in daten/arten. It writes the table docs/forecast-species.md.
// With -apply it sets karte in each species file at or above the threshold.
//
// Usage: go run ./tools/gbifcount -data daten -out ../docs/forecast-species.md -apply
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

// defaultThreshold is the record count from which a species gets a forecast.
// docs/forecast-species.md gives the reason for the value.
const defaultThreshold = 1000

func main() {
	data := flag.String("data", "daten", "the seed data folder with arten/*.toml")
	out := flag.String("out", "../docs/forecast-species.md", "the Markdown table to write")
	cache := flag.String("cache", "", "a JSON file that keeps the GBIF answers between runs; empty: no cache")
	threshold := flag.Int("min", defaultThreshold, "the record count from which a species gets a forecast")
	apply := flag.Bool("apply", false, "set karte in each species file at or above the threshold")
	pause := flag.Duration("pause", time.Second, "the wait between two GBIF requests")
	flag.Parse()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	err := run(ctx, options{data: *data, out: *out, cache: *cache, threshold: *threshold, apply: *apply, pause: *pause})
	stop()
	if err != nil {
		log.Fatal(err)
	}
}

type options struct {
	data, out, cache string
	threshold        int
	apply            bool
	pause            time.Duration
}

func run(ctx context.Context, o options) error {
	profiles, err := importer.LoadProfiles(os.DirFS(o.data))
	if err != nil {
		return err
	}
	answers, err := readCache(o.cache)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	client := newClient(o.pause)
	rows := make([]row, 0, len(profiles))
	for i, p := range profiles {
		a, ok := answers[p.Stem]
		if !ok || a.Latin != p.Profile.Lateinisch {
			if a, err = client.ask(ctx, p.Profile.Lateinisch, now.Year()); err != nil {
				return fmt.Errorf("%s: %w", p.Stem, err)
			}
			answers[p.Stem] = a
			if err := writeCache(o.cache, answers); err != nil {
				return err
			}
		}
		r := decide(p, a, o.threshold)
		log.Printf("%3d/%d %-40s %7d %v", i+1, len(profiles), p.Profile.Lateinisch, a.Count, r.Enabled)
		rows = append(rows, r)
	}
	if o.apply {
		if err := applyKarte(o.data, rows); err != nil {
			return err
		}
	}
	return os.WriteFile(o.out, []byte(report(rows, o.threshold, now)), 0o644)
}

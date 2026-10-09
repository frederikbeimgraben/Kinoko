package runner

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/objects"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/gbif"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/season"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather/dwd"
)

// extractWorkers is the count of checkpoints that the extraction computes at
// the same time. Each worker holds about one year of daily cell means.
const extractWorkers = 2

// Weather brings the weekly checkpoints up to date: it copies the missing ones from
// an active weather-checkpoints upload, then extracts again from the oldest year
// whose raw file changed after the checkpoints. Without raw files they stay as they are.
func (c *Chain) Weather(ctx context.Context, j *Job) error {
	dir := c.weeklyDir()
	if err := c.seedCheckpoints(j, dir); err != nil {
		return err
	}
	raw, err := filepath.Glob(filepath.Join(c.dwdDir(), "hyras", "precipitation", "*.nc"))
	if err != nil {
		return err
	}
	oldest, complete := checkpointTime(dir)
	if len(raw) == 0 {
		if !complete {
			return errors.New("no weather: the cache has no HYRAS file and the weekly checkpoints are not complete")
		}
		j.Printf("weather: no raw files; the checkpoints stay as they are")
		return nil
	}
	rows, err := c.weatherRows(ctx)
	if err != nil {
		return err
	}
	from, need := RefreshFrom(rows, oldest, complete, j.Now)
	if !need {
		j.Printf("weather: the checkpoints are newer than each raw file")
		return nil
	}
	j.Printf("weather: extract from %d", from)
	return weather.Extract(ctx, weather.ExtractConfig{
		Start: dwd.FirstYear, End: j.Now.Year(), RefreshFrom: &from,
		RawDir: c.dwdDir(), CheckpointDir: dir, Workers: extractWorkers,
	}, j)
}

func (c *Chain) weatherRows(ctx context.Context) ([]dwd.CacheRecord, error) {
	hyras, err := c.cache().List(ctx, dwd.SourceHyras)
	if err != nil {
		return nil, err
	}
	soil, err := c.cache().List(ctx, dwd.SourceSoil)
	return append(hyras, soil...), err
}

// checkpointNames are the weekly checkpoints of the extraction.
func checkpointNames() []string {
	return fn.Map(weather.Jobs, func(j weather.Job) string { return j.Name })
}

// checkpointTime gives the oldest change time of the checkpoints, and false
// when a checkpoint is missing.
func checkpointTime(dir string) (time.Time, bool) {
	var oldest time.Time
	for _, name := range checkpointNames() {
		info, err := os.Stat(weather.CheckpointPath(dir, name))
		if err != nil {
			return time.Time{}, false
		}
		if oldest.IsZero() || info.ModTime().Before(oldest) {
			oldest = info.ModTime()
		}
	}
	return oldest, true
}

// RefreshFrom gives the first year that the extraction computes again: the oldest year of
// a raw file that changed after the checkpoints. Without a change no extraction is necessary.
// A missing checkpoint needs an extraction; Extract then computes that one in full.
func RefreshFrom(rows []dwd.CacheRecord, checkpoints time.Time, complete bool, now time.Time) (int, bool) {
	changed := fn.FlatMap(rows, func(r dwd.CacheRecord) []int {
		year, ok := dwd.YearOf(r.Key)
		if !ok || r.State != dwd.StateOK || (complete && !r.FetchedAt.After(checkpoints)) {
			return nil
		}
		return []int{year}
	})
	switch {
	case len(changed) > 0:
		return slices.Min(changed), true
	case !complete:
		return now.Year(), true
	}
	return 0, false
}

// seedCheckpoints copies each missing checkpoint from the active weather-checkpoints upload.
func (c *Chain) seedCheckpoints(j *Job, dir string) error {
	v, err := c.Sources.Resolver().Active(sources.KindWeatherCheckpoints, "")
	if errors.Is(err, sources.ErrMissing) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, name := range checkpointNames() {
		target := weather.CheckpointPath(dir, name)
		a, ok := v.Artifact("weekly/" + name)
		if _, err := os.Stat(target); err == nil || !ok {
			continue
		}
		if err := copyFile(a.Path, target); err != nil {
			return err
		}
		// A seeded checkpoint is older than each raw file of the cache, so RefreshFrom extracts them.
		if err := os.Chtimes(target, time.Unix(0, 0), time.Unix(0, 0)); err != nil {
			return err
		}
		j.Printf("weather: %s from weather-checkpoints version %d", name, v.Number)
	}
	return nil
}

// copyFile copies through a temporary file, so a reader never sees half a file.
func copyFile(from, to string) error {
	if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
		return err
	}
	in, err := os.Open(from)
	if err != nil {
		return err
	}
	defer func() { _ = in.Close() }()
	tmp, err := os.CreateTemp(filepath.Dir(to), "."+filepath.Base(to)+".*")
	if err != nil {
		return err
	}
	// After the rename the temporary name does not exist, so the error is expected.
	defer func() { _ = os.Remove(tmp.Name()) }()
	_, err = io.Copy(tmp, in)
	if err = errors.Join(err, tmp.Close()); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), to)
}

// Occurrences builds the occurrence table from the GBIF cache, the active
// gbif-archive upload and the app training finds (input A6).
func (c *Chain) Occurrences(ctx context.Context, j *Job) error {
	src, err := c.gbifSources()
	if err != nil {
		return err
	}
	app, err := c.appFinds(ctx)
	if err != nil {
		return err
	}
	app, dropped := occ.BoundAppFinds(app, j.Now)
	if dropped != (occ.AppDropped{}) {
		j.Printf("occurrences: dropped %d app finds outside Germany and %d after %s",
			dropped.Outside, dropped.Future, j.Now.Format(time.DateOnly))
	}
	records, stats, err := occ.BuildOccurrences(src, app, occ.MaxUncertainty)
	if err != nil {
		return err
	}
	j.Printf("occurrences: %+v", stats)
	if err := occ.WriteOccurrences(c.occurrences(), records); err != nil {
		return err
	}
	j.Records = records
	return nil
}

// gbifSources names the API cache and the derived files of the active archive with its cutoff year.
func (c *Chain) gbifSources() (occ.Sources, error) {
	src := occ.Sources{API: c.gbifDir()}
	v, err := c.Sources.Resolver().Active(sources.KindGBIFArchive, "")
	if errors.Is(err, sources.ErrMissing) {
		return src, nil
	}
	if err != nil {
		return src, err
	}
	src.Archive = gbif.ArchiveDir(v.Dir)
	if cutoff, ok := v.Metadata["cutoffYear"].(float64); ok {
		src.ArchiveCutoff = int(cutoff)
	}
	return src, nil
}

// appFinds maps the training finds to occ.AppFind with the latin name of their species.
func (c *Chain) appFinds(ctx context.Context) ([]occ.AppFind, error) {
	finds, err := objects.TrainingFinds(ctx, c.DB)
	if err != nil {
		return nil, err
	}
	type named struct {
		id    db.ID
		latin string
	}
	all, err := db.All(ctx, c.DB, func(s db.Scanner) (named, error) {
		var n named
		return n, s.Scan(&n.id, &n.latin)
	}, "SELECT id, latin_name FROM species")
	if err != nil {
		return nil, err
	}
	latin := fn.ToMap(all, func(n named) (db.ID, string) { return n.id, n.latin })
	return fn.Map(finds, func(f objects.TrainingFind) occ.AppFind {
		return occ.AppFind{ID: f.ID.String(), ScientificName: latin[f.SpeciesID], Lat: f.Lat, Lon: f.Lon, FoundOn: f.FoundOn.Time}
	}), nil
}

// Season writes the season table to PILZE_DATA/derived/saison.json.
func (c *Chain) Season(_ context.Context, j *Job) error {
	entries := season.Begehungen(j.Records, season.AbJahr, season.MinArten, season.MaxUnsicherheitM)
	stand, err := season.Stand(entries)
	if err != nil {
		return err
	}
	table, err := season.Table(entries, season.LatinNames(), stand)
	if err != nil {
		return err
	}
	if err := season.Write(c.seasonFile(), table); err != nil {
		return err
	}
	j.Printf("season: %d entries, stand %s, %s", len(entries), stand.Key(), c.seasonFile())
	return nil
}

// errNoRecords tells that a step needs the occurrence step first.
var errNoRecords = fmt.Errorf("the run has no occurrences")

package gbif

import (
	"context"
	"fmt"
	"maps"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio/archive"
)

// MinArchiveRecords is the smallest number of kept rows that makes a valid gbif-archive upload.
const MinArchiveRecords = 1000

// ImportOptions sets the filter of ImportArchive. Zero values take the defaults.
type ImportOptions struct {
	Country    string // "": DE
	MinRecords int    // 0: MinArchiveRecords
	Log        func(format string, args ...any)
}

// ImportMeta is the validation report of a gbif-archive upload (the meta of its data_source row).
type ImportMeta struct {
	Format     string         `json:"format"`
	Records    int            `json:"records"`
	RecordsDE  int            `json:"recordsDE"`
	Years      [2]int         `json:"years"`
	Cutoff     string         `json:"cutoff"`
	CutoffYear int            `json:"cutoffYear"`
	Dropped    map[string]int `json:"dropped"`
	Files      []string       `json:"files"`
}

// ImportArchive streams a GBIF download zip (DwC-A or SIMPLE_CSV) into one slim
// JSON-Lines file per year in outDir, with the filter of the search API query.
// The files appear only when the whole archive is valid; the old files of those years are replaced.
func ImportArchive(ctx context.Context, zipPath, outDir string, opt ImportOptions) (ImportMeta, error) {
	country := or(opt.Country, "DE")
	src, err := archive.OpenOccurrences(zipPath)
	if err != nil {
		return ImportMeta{}, err
	}
	defer src.Close()
	if missing := src.Missing(archive.OccurrenceTerms); len(missing) > 0 {
		return ImportMeta{}, fmt.Errorf("gbif: archive lacks the columns %s", strings.Join(missing, ", "))
	}
	meta := ImportMeta{Format: src.Format(), Dropped: map[string]int{}}
	writers := map[int]*chunkWriter{}
	abort := func() {
		for _, w := range writers {
			w.abort()
		}
	}
	var last time.Time
	for rec, err := range src.Records() {
		if err != nil {
			abort()
			return meta, err
		}
		meta.Records++
		if meta.Records%10_000 == 0 && ctx.Err() != nil {
			abort()
			return meta, ctx.Err()
		}
		row, year, reason := archiveRow(rec, country)
		if reason != "" {
			meta.Dropped[reason]++
			continue
		}
		w := writers[year]
		if w == nil {
			if w, err = newChunkWriter(filepath.Join(outDir, ChunkName(country, year, 0))); err != nil {
				abort()
				return meta, err
			}
			writers[year] = w
		}
		if err := w.write(Line(Slim(row))); err != nil {
			abort()
			return meta, err
		}
		meta.RecordsDE++
		if d, ok := rowDate(row); ok && d.After(last) {
			last = d
		}
	}
	if min := orZero(opt.MinRecords, MinArchiveRecords); meta.RecordsDE < min {
		abort()
		return meta, fmt.Errorf("gbif: archive holds %d Fungi rows of %s, at least %d needed", meta.RecordsDE, country, min)
	}
	years := slices.Sorted(maps.Keys(writers))
	for _, y := range years {
		if err := writers[y].finish(); err != nil {
			abort()
			return meta, err
		}
	}
	for _, y := range years {
		if err := writers[y].commit(); err != nil {
			return meta, err
		}
		meta.Files = append(meta.Files, filepath.Base(writers[y].path))
	}
	meta.Years = [2]int{years[0], years[len(years)-1]}
	cutoff, ok, err := src.PubDate()
	if err != nil || !ok {
		cutoff = last
	}
	meta.Cutoff, meta.CutoffYear = cutoff.Format(time.DateOnly), cutoff.Year()
	if opt.Log != nil {
		opt.Log("gbif archive: %d rows, %d kept in %d years, cutoff %s", meta.Records, meta.RecordsDE, len(years), meta.Cutoff)
	}
	return meta, nil
}

// rowDate gives the date of the year, month and day fields of a converted row.
func rowDate(row map[string]any) (time.Time, bool) {
	y, okY := row["year"].(int64)
	m, okM := row["month"].(int64)
	d, okD := row["day"].(int64)
	if !okY || !okM || !okD || m < 1 || m > 12 || d < 1 || d > 31 {
		return time.Time{}, false
	}
	return time.Date(int(y), time.Month(m), int(d), 0, 0, 0, 0, time.UTC), true
}

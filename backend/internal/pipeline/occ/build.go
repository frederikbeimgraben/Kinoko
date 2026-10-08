package occ

import (
	"cmp"
	"errors"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/core/geo"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/gbif"
)

// ErrNoFiles tells that neither the API cache nor the archive holds a chunk file.
var ErrNoFiles = errors.New("occ: no GBIF files")

// Sources names the two folders of slim GBIF files.
// ArchiveCutoff is the cutoff year of the active gbif-archive upload, 0 when unknown.
type Sources struct {
	API           string
	Archive       string
	ArchiveCutoff int
}

// source is one chunk file and the folder it comes from.
type source struct {
	path string
	name string
	year int
	api  bool
}

// files gives the chunk files to read. The archive gives the years before its
// cutoff year; the API cache gives the later years. A year that only one of the
// two holds comes from that one. Order: by file name, the API first on a tie.
func (s Sources) files() ([]source, error) {
	api, err := chunks(s.API, true)
	if err != nil {
		return nil, err
	}
	arc, err := chunks(s.Archive, false)
	if err != nil {
		return nil, err
	}
	years := func(list []source) map[int]bool {
		out := map[int]bool{}
		for _, f := range list {
			out[f.year] = true
		}
		return out
	}
	apiYears, arcYears := years(api), years(arc)
	keep := func(f source) bool {
		if f.api {
			return f.year >= s.ArchiveCutoff || !arcYears[f.year]
		}
		return f.year < s.ArchiveCutoff || !apiYears[f.year]
	}
	out := slices.DeleteFunc(append(api, arc...), func(f source) bool { return !keep(f) })
	slices.SortStableFunc(out, func(a, b source) int { return cmp.Compare(a.name, b.name) })
	return out, nil
}

// chunks lists the *.jsonl.gz files of dir. An empty dir name or a missing folder gives none.
func chunks(dir string, api bool) ([]source, error) {
	if dir == "" {
		return nil, nil
	}
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var out []source
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".jsonl.gz") {
			continue
		}
		_, year, _, _ := gbif.ParseChunkName(e.Name())
		out = append(out, source{path: filepath.Join(dir, e.Name()), name: e.Name(), year: year, api: api})
	}
	return out, nil
}

// BuildOccurrences is build_occurrences.main without the parquet write: it reads the slim GBIF files,
// adds the app finds, and keeps dated Agaricomycetes records with a coordinate error of at most maxUnc
// metres (NaN keeps). It drops a repeated gbifID. The API copy stays, because the API files come first.
func BuildOccurrences(src Sources, app []AppFind, maxUnc float64) ([]Record, Stats, error) {
	files, err := src.files()
	if err != nil {
		return nil, Stats{}, err
	}
	if len(files) == 0 {
		return nil, Stats{}, ErrNoFiles
	}
	order := slices.Clone(files)
	slices.SortStableFunc(order, func(a, b source) int {
		if a.api != b.api {
			if a.api {
				return -1
			}
			return 1
		}
		return 0
	})
	seen := map[string]bool{}
	perFile := map[string][]Record{}
	var st Stats
	st.Files = len(files)
	intern := interner()
	for _, f := range order {
		var kept []Record
		err := readSlim(f.path, func(l slimLine) {
			st.Read++
			if l.GBIFID.ok {
				if seen[l.GBIFID.s] {
					st.Duplicates++
					return
				}
				seen[l.GBIFID.s] = true
			}
			if r, ok := gbifRecord(l, maxUnc, &st, intern); ok {
				kept = append(kept, r)
			}
		})
		if err != nil {
			return nil, st, err
		}
		perFile[f.path] = kept
	}
	var out []Record
	for _, f := range files {
		out = append(out, perFile[f.path]...)
	}
	for _, f := range app {
		st.App++
		if r, ok := keepRecord(appRecord(f), maxUnc, &st); ok {
			out = append(out, r)
			st.KeptApp++
		}
	}
	st.Kept = len(out)
	return out, st, nil
}

// gbifRecord applies the class, date and error filters of build_occurrences.main to one GBIF line.
func gbifRecord(l slimLine, maxUnc float64, st *Stats, intern func(string) string) (Record, bool) {
	class := l.Class.s
	if l.Class.ok && slices.Contains(LichenClasses, class) {
		st.Lichens++
		return Record{}, false
	}
	if !l.Class.ok || class != TargetClass {
		st.OtherClass++
		return Record{}, false
	}
	day, ok := ParseEventDate(l.EventDate.s)
	if !l.EventDate.ok || !ok || !l.Day.ok {
		st.NoDate++
		return Record{}, false
	}
	r := withTime(Record{
		GBIFID:      l.GBIFID.s,
		Species:     intern(l.Species.s),
		Observer:    intern(l.Observer.s),
		Basis:       BasisGBIF,
		Lat:         l.Lat.value(),
		Lon:         l.Lon.value(),
		Uncertainty: l.Unc.value(),
	}, day)
	return keepRecord(r, maxUnc, st)
}

// keepRecord applies the error filter and adds the grid. A record without a
// coordinate is dropped; pandas would give it a garbage cell.
func keepRecord(r Record, maxUnc float64, st *Stats) (Record, bool) {
	if !r.UncertaintyAtMost(maxUnc) {
		st.TooCoarse++
		return Record{}, false
	}
	if math.IsNaN(r.Lat) || math.IsNaN(r.Lon) {
		st.NoCoordinate++
		return Record{}, false
	}
	r.X, r.Y = geo.LAEA3035(r.Lon, r.Lat)
	r.Cell = geo.CellOf(r.X, r.Y, CellSize)
	return r, true
}

// interner shares the memory of repeated strings such as species names and observer hashes.
func interner() func(string) string {
	pool := map[string]string{}
	return func(s string) string {
		if v, ok := pool[s]; ok {
			return v
		}
		pool[s] = s
		return s
	}
}

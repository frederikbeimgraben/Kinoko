// Package photoseed adds the lead photos of the seed file daten/fotos.json.
// It downloads each photo once, stores it like an upload and keeps the
// author, the licence and the source page. The app then serves the photo
// itself and loads no image from the host of the source.
package photoseed

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/photos"
)

// FileName is the name of the seed file in the data folder.
const FileName = "fotos.json"

// UserAgent identifies the downloads to the host of the photos.
const UserAgent = "KinokoBot/0.1 (https://github.com/frederikbeimgraben/Kinoko)"

// maxPhotographer is the length of the column photo.photographer.
const maxPhotographer = 120

// maxTries limits the attempts of one download after the answers 429 and 5xx.
const maxTries = 6

// Entry is one photo of the seed file.
type Entry struct {
	File       string `json:"datei"`
	URL        string `json:"url"`
	Download   string `json:"bild"`
	Author     string `json:"urheber"`
	Licence    string `json:"lizenz"`
	LicenceURL string `json:"lizenzUrl"`
	Source     string `json:"quelle"`
	Caption    string `json:"beschriftung"`
	CaptionEn  string `json:"beschriftungEn"`
}

// Options are the settings of a run.
type Options struct {
	// Photos is the folder of the photo files.
	Photos string
	// MaxBytes limits the size of one download, as for an upload.
	MaxBytes int64
	// Client sends the downloads. Nil means a client with a timeout of one minute.
	Client *http.Client
	// Pause is the time between two downloads.
	Pause time.Duration
	// Now gives the time of the new rows. Nil means time.Now.
	Now func() time.Time
	// Sleep waits and stops early when the context ends. Nil means a wait on a timer. Tests replace it.
	Sleep func(context.Context, time.Duration) error
	// Out receives one line for each photo.
	Out io.Writer
}

// Report counts the photos of a run.
type Report struct {
	Added   int
	Skipped int
	Lead    int
	// Failed are the entries whose download or store failed. A new run can add them.
	Failed []string
	// Invalid are the entries that a new run cannot add: a bad entry or no species with the slug.
	Invalid []string
}

// Load reads the seed file of the data folder.
func Load(data fs.FS) (map[string]Entry, error) {
	raw, err := fs.ReadFile(data, FileName)
	if err != nil {
		return nil, err
	}
	return Parse(raw)
}

// Parse reads the content of a seed file: one entry for each species slug.
func Parse(raw []byte) (map[string]Entry, error) {
	entries := map[string]Entry{}
	if err := json.Unmarshal(raw, &entries); err != nil {
		return nil, fmt.Errorf("%s: %w", FileName, err)
	}
	return entries, nil
}

// LicenceOf maps the short licence name of the seed file to a licence of the app.
func LicenceOf(name string) (enums.Licence, bool) {
	clean := strings.ToLower(strings.Join(strings.Fields(name), " "))
	switch clean {
	case "cc0", "cc0 1.0":
		return enums.LicenceCc0, true
	case "public domain", "pd":
		return enums.LicencePublicDomain, true
	}
	kind, version, ok := strings.Cut(strings.TrimPrefix(clean, "cc "), " ")
	if !ok || !strings.HasPrefix(clean, "cc ") || (kind != "by" && kind != "by-sa") {
		return "", false
	}
	code := enums.Licence("cc_" + strings.ReplaceAll(kind, "-", "_") + "_" +
		strings.ReplaceAll(strings.TrimSuffix(version, ".0"), ".", "_"))
	return code, code.Valid()
}

// Run adds each photo of the entries that the database does not hold. A
// photo with the same source page counts as present. A photo becomes the
// lead photo of its species when the species has no lead photo.
func Run(ctx context.Context, handle *sql.DB, entries map[string]Entry, opts Options) (Report, error) {
	opts = withDefaults(opts)
	report := Report{}
	slugs := make([]string, 0, len(entries))
	for slug := range entries {
		slugs = append(slugs, slug)
	}
	slices.Sort(slugs)
	first := true
	for _, slug := range slugs {
		entry := entries[slug]
		if err := check(entry); err != nil {
			report.Invalid = append(report.Invalid, slug)
			_, _ = fmt.Fprintf(opts.Out, "%s: %v\n", slug, err)
			continue
		}
		species, found, err := speciesID(ctx, handle, slug)
		if err != nil {
			return report, err
		}
		if !found {
			report.Invalid = append(report.Invalid, slug)
			_, _ = fmt.Fprintf(opts.Out, "%s: no species with this slug\n", slug)
			continue
		}
		// Only a seed photo of the same species counts: an upload can name the same source.
		present, err := db.Scalar[bool](ctx, handle,
			"SELECT EXISTS (SELECT 1 FROM photo WHERE source = ? AND species_id = ? AND owner_id IS NULL)",
			entry.Source, species)
		if err != nil {
			return report, err
		}
		if present {
			report.Skipped++
			continue
		}
		if !first {
			if err := opts.Sleep(ctx, opts.Pause); err != nil {
				return report, err
			}
		}
		first = false
		lead, err := add(ctx, handle, species, entry, opts)
		if err != nil {
			if ctx.Err() != nil {
				return report, ctx.Err()
			}
			report.Failed = append(report.Failed, slug)
			_, _ = fmt.Fprintf(opts.Out, "%s: %v\n", slug, err)
			continue
		}
		report.Added++
		if lead {
			report.Lead++
		}
		_, _ = fmt.Fprintf(opts.Out, "%s: added %s\n", slug, entry.File)
	}
	return report, nil
}

func withDefaults(opts Options) Options {
	if opts.Client == nil {
		opts.Client = &http.Client{Timeout: time.Minute}
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	if opts.Sleep == nil {
		opts.Sleep = wait
	}
	if opts.Out == nil {
		opts.Out = io.Discard
	}
	return opts
}

// check finds an entry that the service cannot store.
func check(e Entry) error {
	if _, ok := LicenceOf(e.Licence); !ok {
		return fmt.Errorf("unknown licence %q", e.Licence)
	}
	if e.Author == "" || utf8.RuneCountInString(e.Author) > maxPhotographer {
		return errors.New("the author is empty or longer than 120 characters")
	}
	if e.Source == "" || (e.Download == "" && e.URL == "") {
		return errors.New("the source page or the file address is missing")
	}
	return nil
}

func speciesID(ctx context.Context, q db.Querier, slug string) (db.ID, bool, error) {
	return db.Maybe(ctx, q, func(s db.Scanner) (db.ID, error) {
		var id db.ID
		return id, s.Scan(&id)
	}, "SELECT id FROM species WHERE slug = ?", slug)
}

// add downloads one photo and stores it. It tells if the photo became the lead photo.
func add(ctx context.Context, handle *sql.DB, species db.ID, e Entry, opts Options) (bool, error) {
	address := e.Download
	if address == "" {
		address = e.URL
	}
	raw, mediaType, err := download(ctx, address, opts)
	if err != nil {
		return false, err
	}
	rendered, err := photos.Accept(raw, mediaType, opts.MaxBytes)
	if err != nil {
		return false, fmt.Errorf("image: %w", err)
	}
	licence, _ := LicenceOf(e.Licence)
	now := db.At(opts.Now())
	return db.InTxValue(ctx, handle, func(tx *sql.Tx) (bool, error) {
		taken, err := db.Scalar[bool](ctx, tx,
			"SELECT EXISTS (SELECT 1 FROM photo WHERE species_id = ? AND lead = 1)", species)
		if err != nil {
			return false, err
		}
		id := db.NewID()
		if _, err := tx.ExecContext(ctx, `INSERT INTO photo (id, owner_id, find_id, species_id, width,
			height, photographer, licence, source, taken_on, caption, caption_en, lat, lon, lead, state,
			reject_reason, reviewed_by_id, reviewed_at, created_at, updated_at)
			VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, ?, 'approved',
			NULL, NULL, ?, ?, ?)`,
			id, species, rendered.Width, rendered.Height, e.Author, string(licence), e.Source,
			nullable(e.Caption), e.CaptionEn, !taken, now, now, now); err != nil {
			return false, err
		}
		return !taken, photos.WriteFiles(opts.Photos, id, rendered)
	})
}

func nullable(text string) *string {
	if text == "" {
		return nil
	}
	return &text
}

// maxDelay is the longest wait after a 429 or 5xx, also when Retry-After asks for more.
const maxDelay = 5 * time.Minute

// wait sleeps for d or until the context ends.
func wait(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// download reads a file with the User-Agent of the project. After the
// answers 429 and 5xx it waits as long as Retry-After asks, at least
// ten seconds and at most maxDelay, and twice as long after each further failure.
func download(ctx context.Context, address string, opts Options) ([]byte, string, error) {
	backoff := 10 * time.Second
	for try := 1; ; try++ {
		raw, mediaType, status, retry, err := fetch(ctx, address, opts)
		if err != nil || status == http.StatusOK {
			return raw, mediaType, err
		}
		if (status != http.StatusTooManyRequests && status < 500) || try == maxTries {
			return nil, "", fmt.Errorf("GET %s: status %d", address, status)
		}
		delay := min(max(retry, backoff), maxDelay)
		_, _ = fmt.Fprintf(opts.Out, "status %d, wait %s\n", status, delay)
		if err := opts.Sleep(ctx, delay); err != nil {
			return nil, "", err
		}
		backoff *= 2
	}
}

func fetch(ctx context.Context, address string, opts Options) ([]byte, string, int, time.Duration, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return nil, "", 0, 0, err
	}
	request.Header.Set("User-Agent", UserAgent)
	response, err := opts.Client.Do(request)
	if err != nil {
		return nil, "", 0, 0, err
	}
	defer func() { _ = response.Body.Close() }()
	var retry time.Duration
	if seconds, err := strconv.Atoi(response.Header.Get("Retry-After")); err == nil {
		retry = time.Duration(seconds) * time.Second
	}
	if response.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 1<<20))
		return nil, "", response.StatusCode, retry, nil
	}
	raw, err := io.ReadAll(io.LimitReader(response.Body, opts.MaxBytes+1))
	if err != nil {
		return nil, "", 0, 0, err
	}
	mediaType, _, err := mime.ParseMediaType(response.Header.Get("Content-Type"))
	if err != nil {
		mediaType = ""
	}
	return raw, mediaType, http.StatusOK, 0, nil
}

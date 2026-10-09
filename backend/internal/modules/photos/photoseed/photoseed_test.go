package photoseed_test

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/jpeg"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"testing/fstest"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/photos"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/photos/photoseed"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

// server serves a JPEG on each path. The first answers of a path in busy are 429.
type server struct {
	mu     sync.Mutex
	hits   map[string]int
	agents []string
	busy   map[string]int
	jpeg   []byte
}

func newServer(t *testing.T) (*server, *httptest.Server) {
	t.Helper()
	made := image.NewRGBA(image.Rect(0, 0, 300, 200))
	for y := range 200 {
		for x := range 300 {
			made.Set(x, y, color.RGBA{R: 140, G: 90, B: 40, A: 255})
		}
	}
	var buffer bytes.Buffer
	if err := jpeg.Encode(&buffer, made, nil); err != nil {
		t.Fatal(err)
	}
	s := &server{hits: map[string]int{}, busy: map[string]int{}, jpeg: buffer.Bytes()}
	host := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		s.hits[r.URL.Path]++
		s.agents = append(s.agents, r.UserAgent())
		busy := s.busy[r.URL.Path] > 0
		if busy {
			s.busy[r.URL.Path]--
		}
		s.mu.Unlock()
		switch {
		case busy:
			w.Header().Set("Retry-After", "30")
			w.WriteHeader(http.StatusTooManyRequests)
		case strings.HasSuffix(r.URL.Path, ".jpg"):
			w.Header().Set("Content-Type", "image/jpeg")
			_, _ = w.Write(s.jpeg)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(host.Close)
	return s, host
}

func (s *server) count(path string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.hits[path]
}

func entry(host, name string) photoseed.Entry {
	return photoseed.Entry{
		File:       "File:" + name,
		URL:        host + "/original/" + name,
		Download:   host + "/thumb/" + name,
		Author:     "Holger Krisp",
		Licence:    "CC BY-SA 3.0",
		LicenceURL: "https://creativecommons.org/licenses/by-sa/3.0/",
		Source:     "https://commons.wikimedia.org/wiki/File:" + name,
		Caption:    "Steinpilz (Boletus edulis)",
		CaptionEn:  "Penny bun (Boletus edulis)",
	}
}

type recorder struct {
	mu     sync.Mutex
	sleeps []time.Duration
}

func (r *recorder) sleep(d time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sleeps = append(r.sleeps, d)
}

// logWriter writes the lines of a run into the test log.
type logWriter struct{ t testing.TB }

func (w logWriter) Write(p []byte) (int, error) {
	w.t.Log(strings.TrimSpace(string(p)))
	return len(p), nil
}

func options(env *testkit.Env, client *http.Client, sleeps *recorder) photoseed.Options {
	return photoseed.Options{
		Photos: env.Settings.Photos, MaxBytes: env.Settings.MaxPhotoBytes, Client: client,
		Pause: 2 * time.Second, Sleep: sleeps.sleep, Out: logWriter{env.T},
	}
}

type row struct {
	id                           db.ID
	owner                        *db.ID
	photographer, licence, state string
	source, caption              *string
	captionEn                    string
	lead                         bool
}

func photoOf(t *testing.T, env *testkit.Env, slug string) []row {
	t.Helper()
	rows, err := env.DB.Query(`SELECT p.id, p.owner_id, p.photographer, p.licence, p.state, p.source,
		p.caption, p.caption_en, p.lead FROM photo p JOIN species s ON s.id = p.species_id
		WHERE s.slug = ? ORDER BY p.created_at`, slug)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = rows.Close() }()
	out := []row{}
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.owner, &r.photographer, &r.licence, &r.state, &r.source,
			&r.caption, &r.captionEn, &r.lead); err != nil {
			t.Fatal(err)
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestRunAddsTheLeadPhotoWithItsCredit(t *testing.T) {
	env := testkit.New(t)
	s, host := newServer(t)
	sleeps := &recorder{}
	entries := map[string]photoseed.Entry{"boletus-edulis": entry(host.URL, "Boletus_edulis.jpg")}

	report, err := photoseed.Run(context.Background(), env.DB, entries, options(env, host.Client(), sleeps))
	if err != nil {
		t.Fatal(err)
	}
	if report.Added != 1 || report.Lead != 1 || report.Skipped != 0 || len(report.Failed) != 0 {
		t.Fatalf("%+v", report)
	}
	if s.count("/thumb/Boletus_edulis.jpg") != 1 || s.count("/original/Boletus_edulis.jpg") != 0 {
		t.Fatal("the run must download the scaled copy once", s.hits)
	}
	if s.agents[0] != photoseed.UserAgent {
		t.Fatal(s.agents)
	}
	rows := photoOf(t, env, "boletus-edulis")
	if len(rows) != 1 {
		t.Fatal(rows)
	}
	got := rows[0]
	if got.owner != nil || got.photographer != "Holger Krisp" || got.licence != "cc_by_sa_3" ||
		got.state != "approved" || !got.lead || got.source == nil ||
		*got.source != "https://commons.wikimedia.org/wiki/File:Boletus_edulis.jpg" ||
		got.caption == nil || *got.caption != "Steinpilz (Boletus edulis)" ||
		got.captionEn != "Penny bun (Boletus edulis)" {
		t.Fatalf("%+v", got)
	}
	for _, size := range enums.PhotoSizeValues {
		path, ok := photos.PathOf(env.Settings.Photos, got.id, size)
		if !ok {
			t.Fatal("missing file", size)
		}
		if _, err := os.Stat(path); err != nil {
			t.Fatal(err)
		}
	}
}

func TestRunGivesThePhotoToTheAPI(t *testing.T) {
	env := testkit.New(t)
	_, host := newServer(t)
	entries := map[string]photoseed.Entry{"boletus-edulis": entry(host.URL, "Boletus_edulis.jpg")}
	if _, err := photoseed.Run(context.Background(), env.DB, entries,
		options(env, host.Client(), &recorder{})); err != nil {
		t.Fatal(err)
	}
	id := photoOf(t, env, "boletus-edulis")[0].id
	body := env.Get("/photos/"+id.String(), nil).Expect(t, http.StatusOK).Map(t)
	if body["photographer"] != "Holger Krisp" || body["ownerName"] != "Holger Krisp" ||
		body["licence"] != "cc_by_sa_3" || body["captionEn"] != "Penny bun (Boletus edulis)" || body["lead"] != true {
		t.Fatal(body)
	}
	env.Get("/photos/"+id.String()+"/full", nil).Expect(t, http.StatusOK)
}

func TestRunSkipsAPhotoWithAKnownSource(t *testing.T) {
	env := testkit.New(t)
	s, host := newServer(t)
	entries := map[string]photoseed.Entry{"boletus-edulis": entry(host.URL, "Boletus_edulis.jpg")}
	opts := options(env, host.Client(), &recorder{})
	if _, err := photoseed.Run(context.Background(), env.DB, entries, opts); err != nil {
		t.Fatal(err)
	}

	report, err := photoseed.Run(context.Background(), env.DB, entries, opts)
	if err != nil {
		t.Fatal(err)
	}
	if report.Added != 0 || report.Skipped != 1 {
		t.Fatalf("%+v", report)
	}
	if s.count("/thumb/Boletus_edulis.jpg") != 1 || len(photoOf(t, env, "boletus-edulis")) != 1 {
		t.Fatal("the second run must not download or add the photo again")
	}
}

func TestRunKeepsTheLeadPhotoOfASpecies(t *testing.T) {
	env := testkit.New(t)
	_, host := newServer(t)
	opts := options(env, host.Client(), &recorder{})
	first := map[string]photoseed.Entry{"boletus-edulis": entry(host.URL, "Eins.jpg")}
	if _, err := photoseed.Run(context.Background(), env.DB, first, opts); err != nil {
		t.Fatal(err)
	}
	second := map[string]photoseed.Entry{"boletus-edulis": entry(host.URL, "Zwei.jpg")}

	report, err := photoseed.Run(context.Background(), env.DB, second, opts)
	if err != nil {
		t.Fatal(err)
	}
	rows := photoOf(t, env, "boletus-edulis")
	if report.Added != 1 || report.Lead != 0 || len(rows) != 2 || !rows[0].lead || rows[1].lead {
		t.Fatalf("%+v %+v", report, rows)
	}
}

func TestRunWaitsAfterTooManyRequests(t *testing.T) {
	env := testkit.New(t)
	s, host := newServer(t)
	s.busy["/thumb/Boletus_edulis.jpg"] = 2
	sleeps := &recorder{}
	entries := map[string]photoseed.Entry{"boletus-edulis": entry(host.URL, "Boletus_edulis.jpg")}

	report, err := photoseed.Run(context.Background(), env.DB, entries, options(env, host.Client(), sleeps))
	if err != nil {
		t.Fatal(err)
	}
	if report.Added != 1 || s.count("/thumb/Boletus_edulis.jpg") != 3 {
		t.Fatalf("%+v %v", report, s.hits)
	}
	// Retry-After asks for 30 s. The second wait doubles the floor of 10 s, so 30 s stays the larger value.
	if len(sleeps.sleeps) != 2 || sleeps.sleeps[0] != 30*time.Second || sleeps.sleeps[1] != 30*time.Second {
		t.Fatal(sleeps.sleeps)
	}
}

func TestRunPausesBetweenDownloads(t *testing.T) {
	env := testkit.New(t)
	_, host := newServer(t)
	sleeps := &recorder{}
	entries := map[string]photoseed.Entry{
		"boletus-edulis":     entry(host.URL, "Eins.jpg"),
		"amanita-pantherina": entry(host.URL, "Zwei.jpg"),
	}

	if _, err := photoseed.Run(context.Background(), env.DB, entries, options(env, host.Client(), sleeps)); err != nil {
		t.Fatal(err)
	}
	if len(sleeps.sleeps) != 1 || sleeps.sleeps[0] != 2*time.Second {
		t.Fatal(sleeps.sleeps)
	}
}

func TestRunReportsBadEntriesAndGoesOn(t *testing.T) {
	env := testkit.New(t)
	_, host := newServer(t)
	unknownLicence := entry(host.URL, "Drei.jpg")
	unknownLicence.Licence = "GFDL"
	missing := entry(host.URL, "Vier.jpg")
	missing.Download = host.URL + "/thumb/Vier.png"
	entries := map[string]photoseed.Entry{
		"gibt-es-nicht":      entry(host.URL, "Eins.jpg"),
		"amanita-pantherina": unknownLicence,
		"suillus-luteus":     missing,
		"boletus-edulis":     entry(host.URL, "Zwei.jpg"),
	}

	report, err := photoseed.Run(context.Background(), env.DB, entries, options(env, host.Client(), &recorder{}))
	if err != nil {
		t.Fatal(err)
	}
	if report.Added != 1 || strings.Join(report.Failed, ",") != "amanita-pantherina,gibt-es-nicht,suillus-luteus" {
		t.Fatalf("%+v", report)
	}
	if len(photoOf(t, env, "amanita-pantherina")) != 0 || len(photoOf(t, env, "boletus-edulis")) != 1 {
		t.Fatal("only the good entry gives a photo")
	}
}

func TestLicenceOf(t *testing.T) {
	cases := map[string]enums.Licence{
		"CC0":            enums.LicenceCc0,
		"CC0 1.0":        enums.LicenceCc0,
		"Public Domain":  enums.LicencePublicDomain,
		"CC BY 4.0":      enums.LicenceCcBy4,
		"CC BY-SA 4.0":   enums.LicenceCcBySa4,
		"CC BY 3.0":      enums.LicenceCcBy3,
		"CC BY-SA 3.0":   enums.LicenceCcBySa3,
		"CC BY 2.5":      enums.LicenceCcBy25,
		"CC BY-SA 2.5":   enums.LicenceCcBySa25,
		"CC BY 2.0":      enums.LicenceCcBy2,
		"CC BY-SA 2.0":   enums.LicenceCcBySa2,
		"cc by-sa  3.0 ": enums.LicenceCcBySa3,
	}
	for name, want := range cases {
		got, ok := photoseed.LicenceOf(name)
		if !ok || got != want {
			t.Errorf("%q: got %q %v, want %q", name, got, ok, want)
		}
	}
	for _, name := range []string{"GFDL", "CC BY-NC 4.0", "CC BY-SA 3.0 DE", "CC BY 1.0", "own", ""} {
		if got, ok := photoseed.LicenceOf(name); ok {
			t.Errorf("%q: got %q, want no licence", name, got)
		}
	}
}

func TestLoadReadsTheSeedFile(t *testing.T) {
	data := fstest.MapFS{photoseed.FileName: {Data: []byte(`{"boletus-edulis": {"datei": "File:A.jpg",
		"urheber": "A", "lizenz": "CC0", "quelle": "https://example.org/a", "bild": "https://example.org/a.jpg",
		"beschriftung": "Steinpilz", "beschriftungEn": "Penny bun"}}`)}}
	entries, err := photoseed.Load(data)
	if err != nil {
		t.Fatal(err)
	}
	got := entries["boletus-edulis"]
	if got.File != "File:A.jpg" || got.Author != "A" || got.Licence != "CC0" || got.CaptionEn != "Penny bun" {
		t.Fatalf("%+v", got)
	}
}

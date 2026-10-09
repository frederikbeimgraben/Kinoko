package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/catalog/importer"
)

// entry is one photo of the seed file daten/fotos.json. The key of the file is the
// slug of the species in the database: the latin name as a slug.
type entry struct {
	File       string `json:"datei"`
	URL        string `json:"url"`
	Download   string `json:"bild"`
	Author     string `json:"urheber"`
	Licence    string `json:"lizenz"`
	LicenceURL string `json:"lizenzUrl,omitempty"`
	Source     string `json:"quelle"`
	Caption    string `json:"beschriftung"`
	CaptionEn  string `json:"beschriftungEn"`
}

// maxAuthor is the length of the column photo.photographer.
const maxAuthor = 120

// minScore is the lowest score of a candidate that the pick step accepts without a picks entry.
const minScore = 0

func runPick(args []string) error {
	flags := flag.NewFlagSet("pick", flag.ContinueOnError)
	dir := flags.String("arten", filepath.Join("daten", "arten"), "folder of the species files")
	in := flags.String("candidates", "candidates.json", "candidate file of the find step")
	picksPath := flags.String("picks", "", "optional file with the chosen file of a species")
	out := flags.String("out", filepath.Join("daten", "fotos.json"), "seed file to write")
	if err := flags.Parse(args); err != nil {
		return err
	}
	list, err := readSpecies(os.DirFS(*dir))
	if err != nil {
		return err
	}
	results := map[string]found{}
	if err := readJSON(*in, &results); err != nil {
		return err
	}
	picks := map[string]string{}
	if *picksPath != "" {
		if err := readJSON(*picksPath, &picks); err != nil && !errors.Is(err, fs.ErrNotExist) {
			return err
		}
	}
	entries := map[string]entry{}
	missing := []string{}
	for _, s := range list {
		rescore(results[s.Slug].Candidates, latinNames(s))
		chosen, ok := choose(results[s.Slug], picks, s.Slug)
		if !ok {
			missing = append(missing, s.Slug)
			continue
		}
		entries[importer.Slugify(s.Latin)] = toEntry(s, results[s.Slug], chosen)
	}
	if err := writeJSON(*out, entries); err != nil {
		return err
	}
	sort.Strings(missing)
	_, _ = fmt.Fprintf(errOut, "%d photos, %d species without a photo:\n", len(entries), len(missing))
	for _, slug := range missing {
		_, _ = fmt.Fprintln(errOut, " ", slug)
	}
	return nil
}

// rescore rates the candidates again with the rules of this version and sorts them.
func rescore(list []candidate, latin []string) {
	for i := range list {
		list[i].Score, list[i].Notes = score(list[i], latin)
	}
	sort.SliceStable(list, func(i, j int) bool { return list[i].Score > list[j].Score })
}

func readJSON(path string, out any) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, out)
}

// choose gives the candidate of the picks file, else the best usable candidate.
func choose(result found, picks map[string]string, slug string) (candidate, bool) {
	title, picked := picks[slug]
	for _, c := range result.Candidates {
		if !acceptable(c) {
			continue
		}
		if picked && c.Title == title {
			return c, true
		}
		if !picked && c.Score >= minScore {
			return c, true
		}
	}
	return candidate{}, false
}

func acceptable(c candidate) bool {
	author := authorOf(c)
	return c.Licence.Code != "" && author != "" && utf8.RuneCountInString(author) <= maxAuthor
}

// authorOf gives the attribution that the author asks for, else the author.
func authorOf(c candidate) string {
	attribution := cleanAuthor(c.Attribution)
	if attribution != "" && !strings.HasPrefix(strings.ToLower(attribution), "http") {
		return attribution
	}
	return cleanAuthor(c.Author)
}

func toEntry(s species, result found, c candidate) entry {
	captionEn := s.Latin
	if result.EnglishName != "" && !strings.EqualFold(result.EnglishName, s.Latin) {
		captionEn = capitalise(result.EnglishName) + " (" + s.Latin + ")"
	}
	return entry{
		File:       c.Title,
		URL:        withoutTracking(c.URL),
		Download:   withoutTracking(c.ThumbURL),
		Author:     authorOf(c),
		Licence:    c.Licence.Name,
		LicenceURL: c.Licence.URL,
		Source:     c.PageURL,
		Caption:    s.Name + " (" + s.Latin + ")",
		CaptionEn:  captionEn,
	}
}

// withoutTracking removes the utm_ parameters that the API adds to a file address.
func withoutTracking(address string) string {
	parsed, err := url.Parse(address)
	if err != nil {
		return address
	}
	query := parsed.Query()
	for key := range query {
		if strings.HasPrefix(key, "utm_") {
			query.Del(key)
		}
	}
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func capitalise(text string) string {
	first, size := utf8.DecodeRuneInString(text)
	return string(unicode.ToUpper(first)) + text[size:]
}

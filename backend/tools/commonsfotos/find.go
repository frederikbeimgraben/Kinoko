package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/BurntSushi/toml"
)

// errOut receives the progress lines.
var errOut io.Writer = os.Stderr

const (
	commonsAPI = "https://commons.wikimedia.org/w/api.php"
	// thumbWidth is a standard thumbnail width of Commons, above the longest edge of the app (1600).
	thumbWidth = 1920
	// keep is the count of candidates that the file keeps for each species.
	keep = 8
)

// species is the part of a species file that the tool reads.
type species struct {
	Slug      string   `toml:"-"`
	Name      string   `toml:"name"`
	Latin     string   `toml:"lateinisch"`
	Synonyms  []string `toml:"synonyme"`
	Edibility string   `toml:"speisewert"`
}

// found is the result of the search for one species.
type found struct {
	Name        string      `json:"name"`
	Latin       string      `json:"latin"`
	EnglishName string      `json:"englishName,omitempty"`
	Candidates  []candidate `json:"candidates"`
}

func runFind(args []string) error {
	flags := flag.NewFlagSet("find", flag.ContinueOnError)
	dir := flags.String("arten", filepath.Join("daten", "arten"), "folder of the species files")
	out := flags.String("out", "candidates.json", "candidate file; species in it are skipped")
	pause := flags.Duration("pause", 3*time.Second, "pause between two requests")
	only := flags.String("only", "", "comma-separated slugs; empty means each species")
	if err := flags.Parse(args); err != nil {
		return err
	}
	list, err := readSpecies(os.DirFS(*dir))
	if err != nil {
		return err
	}
	results := map[string]found{}
	if raw, err := os.ReadFile(*out); err == nil {
		if err := json.Unmarshal(raw, &results); err != nil {
			return err
		}
	} else if !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	wanted := map[string]bool{}
	for _, slug := range strings.Split(*only, ",") {
		if slug != "" {
			wanted[slug] = true
		}
	}
	c := newClient(*pause)
	ctx := context.Background()
	for i, s := range list {
		if _, done := results[s.Slug]; done && len(wanted) == 0 {
			continue
		}
		if len(wanted) > 0 && !wanted[s.Slug] {
			continue
		}
		_, _ = fmt.Fprintf(errOut, "[%d/%d] %s (%s)\n", i+1, len(list), s.Slug, s.Latin)
		result, err := search(ctx, c, s)
		if err != nil {
			return fmt.Errorf("%s: %w", s.Slug, err)
		}
		results[s.Slug] = result
		if err := writeJSON(*out, results); err != nil {
			return err
		}
	}
	return nil
}

func readSpecies(dir fs.FS) ([]species, error) {
	names, err := fs.Glob(dir, "*.toml")
	if err != nil {
		return nil, err
	}
	sort.Strings(names)
	out := make([]species, 0, len(names))
	for _, name := range names {
		raw, err := fs.ReadFile(dir, name)
		if err != nil {
			return nil, err
		}
		var s species
		if _, err := toml.Decode(string(raw), &s); err != nil {
			return nil, fmt.Errorf("%s: %w", name, err)
		}
		s.Slug = strings.TrimSuffix(name, ".toml")
		out = append(out, s)
	}
	return out, nil
}

// latinNames gives the accepted name and then the synonyms, without a note after " = ".
func latinNames(s species) []string {
	names := []string{s.Latin}
	for _, synonym := range s.Synonyms {
		name, _, _ := strings.Cut(synonym, " = ")
		name = strings.TrimSpace(name)
		if name != "" && !slices.Contains(names, name) {
			names = append(names, name)
		}
	}
	return names
}

// search collects the candidates of one species. It starts with the
// category of the accepted name and uses the synonyms only when the
// category gives no usable photo.
func search(ctx context.Context, c *client, s species) (found, error) {
	out := found{Name: s.Name, Latin: s.Latin}
	seen := map[string]bool{}
	all := []candidate{}
	add := func(list []candidate) {
		for _, item := range list {
			if !seen[item.Title] {
				seen[item.Title] = true
				all = append(all, item)
			}
		}
	}
	quote := func(name string) string { return `"` + strings.ReplaceAll(name, `"`, "") + `"` }
	quality, err := commonsSearch(ctx, c, "deepcat:"+quote(s.Latin)+" hastemplate:QualityImage filetype:bitmap")
	if err != nil {
		return out, err
	}
	add(quality)
	names := latinNames(s)
	rescore(quality, names)
	if countGood(quality) >= 3 {
		names = nil
	}
	for i, name := range names {
		if i > 2 || (i > 0 && usable(all)) {
			break
		}
		list, err := commonsSearch(ctx, c, "deepcat:"+quote(name)+" filetype:bitmap")
		if err != nil {
			return out, err
		}
		add(list)
	}
	if !usable(all) {
		list, err := commonsSearch(ctx, c, `intitle:"`+s.Latin+`" filetype:bitmap`)
		if err != nil {
			return out, err
		}
		add(list)
	}
	rescore(all, latinNames(s))
	if len(all) > keep {
		all = all[:keep]
	}
	out.Candidates = all
	return out, nil
}

func usable(list []candidate) bool { return countUsable(list) > 0 }

// countGood counts the candidates with a score that the pick step accepts.
func countGood(list []candidate) int {
	count := 0
	for _, c := range list {
		if c.Score >= minScore {
			count++
		}
	}
	return count
}

func countUsable(list []candidate) int {
	count := 0
	for _, c := range list {
		if c.Licence.Code != "" {
			count++
		}
	}
	return count
}

type metaValue struct {
	Value any `json:"value"`
}

type imageInfo struct {
	URL            string               `json:"url"`
	ThumbURL       string               `json:"thumburl"`
	DescriptionURL string               `json:"descriptionurl"`
	Width          int                  `json:"width"`
	Height         int                  `json:"height"`
	Size           int                  `json:"size"`
	Mime           string               `json:"mime"`
	Meta           map[string]metaValue `json:"extmetadata"`
}

type apiAnswer struct {
	Query struct {
		Pages []struct {
			Title     string      `json:"title"`
			Index     int         `json:"index"`
			ImageInfo []imageInfo `json:"imageinfo"`
		} `json:"pages"`
	} `json:"query"`
}

// commonsSearch gives the files that a CirrusSearch query finds, with their metadata.
func commonsSearch(ctx context.Context, c *client, query string) ([]candidate, error) {
	values := url.Values{
		"action":                {"query"},
		"format":                {"json"},
		"formatversion":         {"2"},
		"generator":             {"search"},
		"gsrsearch":             {query},
		"gsrnamespace":          {"6"},
		"gsrlimit":              {"40"},
		"prop":                  {"imageinfo"},
		"iiprop":                {"url|size|mime|extmetadata"},
		"iiurlwidth":            {fmt.Sprint(thumbWidth)},
		"iiextmetadatafilter":   {"Artist|Attribution|LicenseShortName|LicenseUrl|Assessments|ImageDescription|Categories|Restrictions"},
		"iiextmetadatalanguage": {"en"},
		"maxlag":                {"5"},
	}
	var answer apiAnswer
	if err := c.getJSON(ctx, commonsAPI, values, &answer); err != nil {
		return nil, err
	}
	pages := answer.Query.Pages
	sort.SliceStable(pages, func(i, j int) bool { return pages[i].Index < pages[j].Index })
	out := []candidate{}
	for _, page := range pages {
		if len(page.ImageInfo) == 0 {
			continue
		}
		out = append(out, toCandidate(page.Title, page.ImageInfo[0]))
	}
	return out, nil
}

func metaText(meta map[string]metaValue, key string) string {
	value, ok := meta[key]
	if !ok {
		return ""
	}
	switch v := value.Value.(type) {
	case string:
		return v
	case map[string]any:
		if en, ok := v["en"].(string); ok {
			return en
		}
		for _, any := range v {
			if text, ok := any.(string); ok {
				return text
			}
		}
	}
	return fmt.Sprint(value.Value)
}

func toCandidate(title string, info imageInfo) candidate {
	meta := info.Meta
	short := strings.TrimSpace(metaText(meta, "LicenseShortName"))
	licenceURL := strings.TrimSpace(metaText(meta, "LicenseUrl"))
	return candidate{
		Title:        title,
		URL:          info.URL,
		ThumbURL:     info.ThumbURL,
		PageURL:      info.DescriptionURL,
		Width:        info.Width,
		Height:       info.Height,
		Bytes:        info.Size,
		Mime:         info.Mime,
		Author:       plainText(metaText(meta, "Artist")),
		Attribution:  plainText(metaText(meta, "Attribution")),
		LicenceName:  short,
		Licence:      parseLicence(short, licenceURL),
		Assessments:  metaText(meta, "Assessments"),
		Description:  clip(plainText(metaText(meta, "ImageDescription")), 300),
		Categories:   metaText(meta, "Categories"),
		Restrictions: metaText(meta, "Restrictions"),
	}
}

func clip(text string, limit int) string {
	runes := []rune(text)
	if len(runes) <= limit {
		return text
	}
	return string(runes[:limit]) + "…"
}

func writeJSON(path string, value any) error {
	raw, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(raw, '\n'), 0o644)
}

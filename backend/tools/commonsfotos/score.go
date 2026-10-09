package main

import (
	"html"
	"regexp"
	"strings"
)

// candidate is one file on Commons with the data that the seed file needs.
type candidate struct {
	Title        string   `json:"title"`
	URL          string   `json:"url"`
	ThumbURL     string   `json:"thumbUrl"`
	PageURL      string   `json:"pageUrl"`
	Width        int      `json:"width"`
	Height       int      `json:"height"`
	Bytes        int      `json:"bytes"`
	Mime         string   `json:"mime"`
	Author       string   `json:"author"`
	Attribution  string   `json:"attribution,omitempty"`
	LicenceName  string   `json:"licenceName"`
	Licence      licence  `json:"licence"`
	Assessments  string   `json:"assessments,omitempty"`
	Description  string   `json:"description,omitempty"`
	Categories   string   `json:"categories,omitempty"`
	Restrictions string   `json:"restrictions,omitempty"`
	Score        int      `json:"score"`
	Notes        []string `json:"notes,omitempty"`
}

// licence is a licence that the app accepts. An empty code means that the
// app cannot use the file.
type licence struct {
	Code string `json:"code"`
	Name string `json:"name"`
	URL  string `json:"url"`
}

// ccURL matches an unported Creative Commons licence or CC0. A ported
// licence (for example "3.0/de") has a different text, so the tool skips it.
var ccURL = regexp.MustCompile(`^https?://creativecommons\.org/(licenses/(by|by-sa)/(4\.0|3\.0|2\.5|2\.0)|publicdomain/zero/1\.0)/?(deed\.[a-z-]+)?$`)

// parseLicence maps the licence of Commons to a licence of the app.
func parseLicence(short, address string) licence {
	if strings.EqualFold(short, "Public domain") {
		return licence{Code: "public_domain", Name: "Public Domain"}
	}
	match := ccURL.FindStringSubmatch(address)
	if match == nil {
		return licence{}
	}
	if match[2] == "" {
		return licence{Code: "cc0", Name: "CC0 1.0", URL: "https://creativecommons.org/publicdomain/zero/1.0/"}
	}
	kind, version := match[2], match[3]
	code := "cc_" + strings.ReplaceAll(kind, "-", "_") + "_" + strings.ReplaceAll(strings.TrimSuffix(version, ".0"), ".", "_")
	name := "CC " + strings.ToUpper(kind) + " " + version
	return licence{Code: code, Name: name, URL: "https://creativecommons.org/licenses/" + kind + "/" + version + "/"}
}

var (
	tags   = regexp.MustCompile(`<[^>]*>`)
	spaces = regexp.MustCompile(`\s+`)
)

// plainText removes the HTML of a metadata value.
func plainText(value string) string {
	text := html.UnescapeString(tags.ReplaceAllString(value, " "))
	return strings.TrimSpace(spaces.ReplaceAllString(text, " "))
}

// badWords mark files that do not show the fruiting bodies in the field.
var badWords = []string{
	"microscop", "mikroskop", "micrograph", "spore", "cystid", "zystid", "basidia", "basidium", "hyphae",
	"drawing", "zeichnung", "illustration", "plate", "tafel", "herbar", "exsiccat", "specimen",
	"stamp", "briefmarke", "painting", "aquarell", "watercolo", "distribution", "verbreitung",
	" map", "karte", "dried", "getrocknet", "culture", "kultur", "mycel", "x400", "x1000",
	"400x", "1000x", "logo", "icon", " dish", "cooked", "soup", "recipe", "gericht", "market",
	"markt", "molecule", "chemical structure", "sem image", "cross section", "cross-section",
	"longitudinal section", "querschnitt", "längsschnitt", "book", "museum", " model", "modell",
	"sculpture", "skulptur", "münze", "basket", "korb", "harvest", "ernte", "edible fungi",
	"speisepilze", "mixed", "collage", "comparison", "vergleich",
}

// score rates a candidate: a high value is a good lead photo. The notes give the reasons.
func score(c candidate, latin []string) (int, []string) {
	total := 0
	notes := []string{}
	note := func(points int, reason string) {
		total += points
		notes = append(notes, reason)
	}
	if c.Licence.Code == "" {
		note(-1000, "licence "+c.LicenceName)
	}
	if c.Author == "" && c.Attribution == "" {
		note(-1000, "no author")
	}
	if c.Mime != "image/jpeg" {
		note(-200, "type "+c.Mime)
	}
	if c.Restrictions != "" {
		note(-50, "restrictions "+c.Restrictions)
	}
	text := strings.ToLower(c.Title + " " + c.Description + " " + c.Categories)
	for _, word := range badWords {
		if strings.Contains(text, word) {
			note(-300, "word "+strings.TrimSpace(word))
		}
	}
	assessments := strings.ToLower(c.Assessments)
	for _, a := range []struct {
		key    string
		points int
	}{{"featured", 20}, {"quality", 25}, {"valued", 20}, {"poty", 5}} {
		if strings.Contains(assessments, a.key) {
			note(a.points, a.key)
		}
	}
	short, long := min(c.Width, c.Height), max(c.Width, c.Height)
	switch {
	case short < 600:
		note(-300, "small")
	case c.Width*c.Height < 1_000_000:
		note(-20, "below 1 MP")
	case c.Width*c.Height >= 2_000_000:
		note(5, "2 MP")
	}
	if short > 0 && float64(long)/float64(short) > 2.2 {
		note(-30, "narrow")
	}
	title := strings.ToLower(c.Title)
	categories := "|" + strings.ToLower(c.Categories) + "|"
	for i, name := range latin {
		name = strings.ToLower(name)
		if strings.Contains(title, name) || strings.Contains(title, strings.ReplaceAll(name, " ", "_")) {
			note(25-5*min(i, 2), "name in title")
			break
		}
	}
	for _, name := range latin {
		if strings.Contains(categories, "|"+strings.ToLower(name)+"|") {
			note(15, "in category")
			break
		}
	}
	return total, notes
}

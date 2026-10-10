package main

import (
	"context"
	"flag"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode"
)

const gbifAPI = "https://api.gbif.org/v1/species"

// trustedSources give English names, best first. The UK Species Inventory
// holds the recommended English names of the British Mycological Society.
var trustedSources = []string{"United Kingdom Species Inventory (UKSI)", "The IUCN Red List of Threatened Species"}

// runNames adds the English common names of GBIF to the candidate file.
func runNames(args []string) error {
	flags := flag.NewFlagSet("names", flag.ContinueOnError)
	dir := flags.String("arten", filepath.Join("daten", "arten"), "folder of the species files")
	path := flags.String("candidates", "candidates.json", "candidate file of the find step")
	pause := flags.Duration("pause", time.Second, "pause between two requests")
	if err := flags.Parse(args); err != nil {
		return err
	}
	list, err := readSpecies(os.DirFS(*dir))
	if err != nil {
		return err
	}
	results := map[string]found{}
	if err := readJSON(*path, &results); err != nil {
		return err
	}
	c := newClient(*pause)
	count := 0
	for _, s := range list {
		result, ok := results[s.Slug]
		if !ok {
			continue
		}
		name, err := gbifEnglishName(context.Background(), c, s.Latin)
		if err != nil {
			return fmt.Errorf("%s: %w", s.Slug, err)
		}
		result.EnglishName = name
		if name != "" {
			count++
		}
		results[s.Slug] = result
	}
	_, _ = fmt.Fprintf(errOut, "%d of %d species have an English name\n", count, len(results))
	return writeJSON(*path, results)
}

type vernacular struct {
	Name      string `json:"vernacularName"`
	Language  string `json:"language"`
	Source    string `json:"source"`
	Preferred bool   `json:"preferred"`
}

// gbifEnglishName gives the English name of a species from a trusted source of GBIF, or "".
func gbifEnglishName(ctx context.Context, c *client, latin string) (string, error) {
	var match struct {
		UsageKey  int    `json:"usageKey"`
		MatchType string `json:"matchType"`
		Rank      string `json:"rank"`
	}
	err := c.getJSON(ctx, gbifAPI+"/match", url.Values{"name": {latin}, "kingdom": {"Fungi"}, "strict": {"true"}}, &match)
	if err != nil || match.UsageKey == 0 || match.MatchType != "EXACT" || match.Rank != "SPECIES" {
		return "", err
	}
	var names struct {
		Results []vernacular `json:"results"`
	}
	address := fmt.Sprintf("%s/%d/vernacularNames", gbifAPI, match.UsageKey)
	if err := c.getJSON(ctx, address, url.Values{"limit": {"300"}}, &names); err != nil {
		return "", err
	}
	return bestEnglish(names.Results), nil
}

// bestEnglish picks the English name of the best trusted source; a preferred name wins in a source.
func bestEnglish(list []vernacular) string {
	for _, source := range trustedSources {
		best := ""
		for _, v := range list {
			if v.Source != source || (v.Language != "eng" && v.Language != "en") {
				continue
			}
			if best == "" || v.Preferred {
				best = v.Name
			}
			if v.Preferred {
				break
			}
		}
		if best != "" {
			return sentenceCase(best)
		}
	}
	return ""
}

// sentenceCase writes a name as at the start of a sentence: "Penny Bun" gives
// "Penny bun". A possessive ("George's"), the word after "St" and an acronym stay.
func sentenceCase(name string) string {
	words := strings.Fields(name)
	for i := 1; i < len(words); i++ {
		word := words[i]
		previous := strings.TrimSuffix(words[i-1], ".")
		if strings.HasSuffix(word, "'s") || previous == "St" || isAcronym(word) {
			continue
		}
		words[i] = strings.ToLower(word)
	}
	return strings.Join(words, " ")
}

func isAcronym(word string) bool {
	letters := 0
	for _, r := range word {
		if unicode.IsLetter(r) {
			letters++
			if !unicode.IsUpper(r) {
				return false
			}
		}
	}
	return letters > 1
}

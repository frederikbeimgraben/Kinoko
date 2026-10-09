package main

import (
	"context"
	"flag"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const sparqlEndpoint = "https://query.wikidata.org/sparql"

// chunk is the count of names in one SPARQL query.
const chunk = 60

// runNames adds the English common names of Wikidata (property P1843) to the
// candidate file. It sends one query for each group of 60 species.
func runNames(args []string) error {
	flags := flag.NewFlagSet("names", flag.ContinueOnError)
	dir := flags.String("arten", filepath.Join("daten", "arten"), "folder of the species files")
	path := flags.String("candidates", "candidates.json", "candidate file of the find step")
	pause := flags.Duration("pause", 5*time.Second, "pause between two requests")
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
	names := map[string][]string{}
	for start := 0; start < len(list); start += chunk {
		part := list[start:min(start+chunk, len(list))]
		found, err := commonNames(context.Background(), c, part)
		if err != nil {
			return err
		}
		for latin, list := range found {
			names[latin] = append(names[latin], list...)
		}
	}
	count := 0
	for slug, result := range results {
		choices := names[result.Latin]
		sort.Strings(choices)
		result.EnglishName = ""
		if len(choices) > 0 {
			result.EnglishName = choices[0]
			count++
		}
		results[slug] = result
	}
	_, _ = fmt.Fprintf(errOut, "%d of %d species have an English name\n", count, len(results))
	return writeJSON(*path, results)
}

func commonNames(ctx context.Context, c *client, list []species) (map[string][]string, error) {
	values := make([]string, len(list))
	for i, s := range list {
		values[i] = `"` + strings.ReplaceAll(s.Latin, `"`, "") + `"`
	}
	query := `SELECT ?name ?common WHERE { VALUES ?name { ` + strings.Join(values, " ") + ` }
		?item wdt:P225 ?name; wdt:P1843 ?common. FILTER(LANG(?common) = "en") }`
	var answer struct {
		Results struct {
			Bindings []map[string]struct {
				Value string `json:"value"`
			} `json:"bindings"`
		} `json:"results"`
	}
	if err := c.getJSON(ctx, sparqlEndpoint, url.Values{"query": {query}, "format": {"json"}}, &answer); err != nil {
		return nil, err
	}
	out := map[string][]string{}
	for _, row := range answer.Results.Bindings {
		latin, common := row["name"].Value, strings.TrimSpace(row["common"].Value)
		if common != "" {
			out[latin] = append(out[latin], common)
		}
	}
	return out, nil
}

package main

import (
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/train"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ/visits"
)

// header is the fixed text of docs/forecast-species.md. The verbs %[n] take
// the threshold, MinPositives, MinSpecies, MinFoldRows, MinFoldPositives, MinYear, MaxUncertainty and threshold/5.
const header = `# Forecast species

The tool ` + "`backend/tools/gbifcount`" + ` writes this file. Do not change it by hand.
Run the tool again to update it.

## What a species needs

A species gets a forecast when its file in ` + "`backend/daten/arten`" + ` has ` + "`karte`" + `.
The import then sets ` + "`forecast_enabled`" + `. Each training run trains one model for each such species.
The training of a species fails in these conditions:

- The visit table has fewer than %[2]d positive visits (` + "`visits.MinPositives`" + `). A visit is one observer, on one day, in one square kilometre. A visit counts only with at least %[3]d species (` + "`visits.MinSpecies`" + `).
- The year scheme or the space scheme gives no fold. The test part of a fold needs %[4]d rows (` + "`train.MinFoldRows`" + `) and %[5]d positive visits (` + "`train.MinFoldPositives`" + `).

The training reads the records from %[6]d (` + "`visits.MinYear`" + `). A record must have a coordinate error of at most %[7]g m, or no coordinate error (` + "`occ.TrainingSet`" + `).
The five horizons (0 to 4 weeks) use the same visit table. Thus the horizons add no condition.

## Threshold

The threshold is %[1]d records.

The count of GBIF records is larger than the count of positive visits:

- A record without an observer gives no visit.
- A visit with only the target species does not pass the gate.
- Two records of one visit give one positive visit.

The threshold assumes that at least one record in five gives a positive visit.
Then a species at the threshold has about %[8]d positive visits. The minimum is %[2]d.
The margin also helps the folds: each year and each 100 km band needs %[5]d positive visits to give a fold.

The tool turns the forecast on for a species without ` + "`karte`" + ` only when all these conditions are true:

- GBIF matches the Latin name to a species of the class Agaricomycetes. The occurrence step keeps only this class.
- The GBIF species name is the Latin name of the catalogue. The chain finds its records by this name.
- The count is at least the threshold.

The new ` + "`karte`" + ` value is the Latin name in lower case with underscores, for example ` + "`boletus_edulis`" + ` (` + "`sources.ChainKey`" + `).
A species without a row in ` + "`species_forecast`" + ` trains with ` + "`sources.DefaultChain`" + `: this key and the Latin name as its taxon.
A species that is a taxon of a chain in ` + "`sources.Chains`" + ` counts the taxa of that chain.
A species with ` + "`karte`" + ` keeps it, also below the threshold.

An existing database keeps its forecast flags. Run ` + "`kinoko import-catalog`" + `, or set the flags in the admin area.

## Count

The tool asks ` + "`api.gbif.org/v1/species/match`" + ` for the GBIF key of the Latin name.
Then it asks ` + "`api.gbif.org/v1/occurrence/search`" + ` with ` + "`limit=0`" + ` for the count, with the filter of the GBIF fetch (` + "`gbif.Filter`" + `):

- ` + "`country=DE`" + `, ` + "`hasCoordinate=true`" + `, ` + "`hasGeospatialIssue=false`" + `, ` + "`basisOfRecord=HUMAN_OBSERVATION`" + `, ` + "`occurrenceStatus=PRESENT`" + `
- ` + "`taxonKey`" + ` = the species key of the match. GBIF then also counts the synonyms.
- ` + "`year`" + ` = %[6]d to the year of the query.

The count is all these records minus the records with ` + "`coordinateUncertaintyInMeters`" + ` above %[7]g m.
GBIF filters by calendar year and the training by ISO year. Thus a few records at the start of %[6]d can differ.

## Run the tool again

` + "```" + `
cd backend
nix develop ..#backend -c go run ./tools/gbifcount -cache /tmp/gbifcount.json
nix develop ..#backend -c go run ./tools/gbifcount -cache /tmp/gbifcount.json -apply
` + "```" + `

The first command writes this file only. The second command also sets ` + "`karte`" + ` in the species files.
With ` + "`-cache`" + `, the second command sends no request. ` + "`-min`" + ` sets a different threshold.
The tool waits ` + "`-pause`" + ` (1 s) before each request. After an HTTP 429 it waits at least 30 s.
A run without cache sends about 900 requests.

`

// report gives the Markdown file with the header, a summary and one row per species.
func report(rows []row, threshold int, now time.Time) string {
	var b strings.Builder
	fmt.Fprintf(&b, header, threshold, visits.MinPositives, visits.MinSpecies, train.MinFoldRows,
		train.MinFoldPositives, visits.MinYear, visits.MaxUncertainty, threshold/5)
	enabled, chained := 0, 0
	for _, r := range rows {
		if r.Enabled {
			enabled++
		}
		if slices.ContainsFunc(sources.Chains, func(c sources.Chain) bool { return c.Key == r.Karte }) {
			chained++
		}
	}
	b.WriteString("## Species\n\n")
	fmt.Fprintf(&b, "Query date: %s. Species: %d. With forecast: %d. Of these, %d have a chain in `sources.Chains`.\n\n",
		now.Format(time.DateOnly), len(rows), enabled, chained)
	b.WriteString("The rows follow the order of the file names.\n\n")
	b.WriteString("| Species | Latin name | GBIF key | Records | Forecast | Note |\n")
	b.WriteString("| --- | --- | ---: | ---: | --- | --- |\n")
	for _, r := range rows {
		fmt.Fprintf(&b, "| %s | *%s* | %s | %s | %s | %s |\n", cell(r.Name), cell(r.Latin),
			key(r.Answer.Match.SpeciesKey), count(r.Answer.Count), state(r), cell(r.Note))
	}
	return b.String()
}

func key(k int) string {
	if k == 0 {
		return "-"
	}
	return strconv.Itoa(k)
}

func count(n int) string {
	if n < 0 {
		return "-"
	}
	return strconv.Itoa(n)
}

func state(r row) string {
	if !r.Enabled {
		return "no"
	}
	return "yes (`" + r.Karte + "`)"
}

func cell(s string) string {
	return strings.ReplaceAll(s, "|", "\\|")
}

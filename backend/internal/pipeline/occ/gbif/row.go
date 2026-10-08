package gbif

import (
	"strconv"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio/archive"
)

// intFields and floatFields are the Fields that the search API gives as numbers.
// An archive gives them as text, so the import converts them to the API types.
var (
	intFields   = []string{"taxonKey", "acceptedTaxonKey", "speciesKey", "genusKey", "year", "month", "day", "individualCount"}
	floatFields = []string{"decimalLatitude", "decimalLongitude", "coordinateUncertaintyInMeters", "elevation"}
)

// geospatialIssues are the GBIF issues that set hasGeospatialIssue (OccurrenceIssue.GEOSPATIAL_RULES).
var geospatialIssues = []string{"ZERO_COORDINATE", "COORDINATE_OUT_OF_RANGE", "COORDINATE_INVALID", "COUNTRY_COORDINATE_MISMATCH"}

// Reasons that ImportArchive counts for a dropped row.
const (
	DropCountry    = "country"
	DropKingdom    = "kingdom"
	DropBasis      = "basisOfRecord"
	DropStatus     = "occurrenceStatus"
	DropCoordinate = "coordinate"
	DropGeospatial = "geospatialIssue"
	DropYear       = "year"
)

// archiveRow applies the query filter of the search API to one archive row and
// converts it to the shape of an API record. reason is "" for a kept row.
func archiveRow(rec archive.Record, country string) (row map[string]any, year int, reason string) {
	switch {
	case !strings.EqualFold(rec.Get("countryCode"), country):
		return nil, 0, DropCountry
	case rec.Get("kingdom") != "Fungi":
		return nil, 0, DropKingdom
	case rec.Get("basisOfRecord") != "HUMAN_OBSERVATION":
		return nil, 0, DropBasis
	case !presentStatus(rec.Get("occurrenceStatus")):
		return nil, 0, DropStatus
	}
	row = map[string]any{}
	for _, k := range Fields {
		if v := rec.Get(k); v != "" {
			row[k] = v
		}
	}
	for _, k := range intFields {
		convert(row, k, func(s string) (any, error) { return strconv.ParseInt(s, 10, 64) })
	}
	for _, k := range floatFields {
		convert(row, k, func(s string) (any, error) { return strconv.ParseFloat(s, 64) })
	}
	if _, ok := row["decimalLatitude"].(float64); !ok {
		return nil, 0, DropCoordinate
	}
	if _, ok := row["decimalLongitude"].(float64); !ok {
		return nil, 0, DropCoordinate
	}
	issues := splitIssues(rec.Get("issue"))
	row["issues"] = issues
	if geospatial(rec.Get("hasGeospatialIssues"), issues) {
		return nil, 0, DropGeospatial
	}
	if v := rec.Get("recordedBy"); v != "" {
		row["recordedBy"] = v
	}
	y, ok := row["year"].(int64)
	if !ok {
		return nil, 0, DropYear
	}
	return row, int(y), ""
}

// presentStatus accepts PRESENT. An archive without the column holds only what the download asked for.
func presentStatus(s string) bool { return s == "" || s == "PRESENT" }

func convert(row map[string]any, key string, parse func(string) (any, error)) {
	s, ok := row[key].(string)
	if !ok {
		return
	}
	if v, err := parse(strings.TrimSpace(s)); err == nil {
		row[key] = v
	} else {
		delete(row, key)
	}
}

// splitIssues turns the ";"-separated issue column into the issues list of the API.
func splitIssues(s string) []any {
	out := []any{}
	for _, part := range strings.Split(s, ";") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}

// geospatial uses the hasGeospatialIssues column of a DwC-A when it has one, else the issue list.
func geospatial(flag string, issues []any) bool {
	if flag != "" {
		return strings.EqualFold(flag, "true")
	}
	for _, i := range issues {
		for _, g := range geospatialIssues {
			if i == g {
				return true
			}
		}
	}
	return false
}

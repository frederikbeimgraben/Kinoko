package catalog

import (
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

var (
	sizeParam  = regexp.MustCompile(`^size\[([a-z_]+)\.([a-z_]+)\]$`)
	rangeValue = regexp.MustCompile(`^([0-9.]*)-([0-9.]*)$`)
	hexColour  = regexp.MustCompile(`^#[0-9a-f]{6}$`)
)

// colourParams maps each body part with a colour filter to its query name.
var colourParams = []struct {
	Part enums.BodyPart
	Name string
}{
	{enums.BodyPartCap, "cap"},
	{enums.BodyPartStem, "stem"},
	{enums.BodyPartGills, "gills"},
	{enums.BodyPartFlesh, "flesh"},
	{enums.BodyPartSporePrint, "sporePrint"},
	{enums.BodyPartTubes, "tubes"},
	{enums.BodyPartPores, "pores"},
}

type pair struct{ key, value string }

// queryPairs gives the query values in the order of the request.
func queryPairs(raw string) []pair {
	return fn.FlatMap(strings.Split(raw, "&"), func(part string) []pair {
		if part == "" {
			return nil
		}
		key, value, _ := strings.Cut(part, "=")
		k, err1 := url.QueryUnescape(key)
		v, err2 := url.QueryUnescape(value)
		if err1 != nil || err2 != nil {
			return nil
		}
		return []pair{{k, v}}
	})
}

func parseBound(text string) (*float64, bool) {
	if text == "" {
		return nil, true
	}
	value, err := strconv.ParseFloat(text, 64)
	return &value, err == nil
}

// parseSizes reads size[part.dimension]=low-high. A later value of a key wins.
func parseSizes(pairs []pair) (map[sizeKey]bound, error) {
	found := map[sizeKey]bound{}
	for _, p := range pairs {
		match := sizeParam.FindStringSubmatch(p.key)
		if match == nil {
			continue
		}
		bad := problem.InvalidField(p.key, "size")
		part, dimension := enums.BodyPart(match[1]), enums.Dimension(match[2])
		if !part.Valid() || !dimension.Valid() {
			return nil, bad
		}
		limits := rangeValue.FindStringSubmatch(p.value)
		if limits == nil {
			return nil, bad
		}
		low, okLow := parseBound(limits[1])
		high, okHigh := parseBound(limits[2])
		if !okLow || !okHigh {
			return nil, bad
		}
		found[sizeKey{part, dimension}] = bound{low, high}
	}
	return found, nil
}

func parseColours(values url.Values) (map[enums.BodyPart]string, error) {
	found := map[enums.BodyPart]string{}
	for _, c := range colourParams {
		key := "colour[" + c.Name + "]"
		value := lastValue(values, key)
		if value == "" {
			continue
		}
		if !hexColour.MatchString(value) {
			return nil, problem.InvalidField(key, "pattern")
		}
		found[c.Part] = value
	}
	return found, nil
}

// lastValue gives the last value of a query key, or "" when the key is not
// there. Starlette's QueryParams.get and FastAPI's scalar query parameters
// take the last value, so a repeated key must give the same filter.
func lastValue(values url.Values, key string) string {
	if all := values[key]; len(all) > 0 {
		return all[len(all)-1]
	}
	return ""
}

func distinct[T comparable](values []T) []T {
	return fn.Reduce(values, []T{}, func(acc []T, v T) []T {
		if fn.Any(acc, func(x T) bool { return x == v }) {
			return acc
		}
		return append(acc, v)
	})
}

// parseSelection builds the filter from the query. The contract has
// already checked the enum, uuid and month values.
func parseSelection(u *url.URL) (Selection, error) {
	values := u.Query()
	terms, err := fn.MapErr(values["terms[]"], db.ParseID)
	if err != nil {
		return Selection{}, problem.InvalidField("terms[]", "uuid_parsing")
	}
	months, err := fn.MapErr(values["months[]"], strconv.Atoi)
	if err != nil {
		return Selection{}, problem.InvalidField("months[]", "int_parsing")
	}
	colours, err := parseColours(values)
	if err != nil {
		return Selection{}, err
	}
	sizes, err := parseSizes(queryPairs(u.RawQuery))
	if err != nil {
		return Selection{}, err
	}
	return Selection{
		Edibility: distinct(fn.Map(values["edibility[]"], func(v string) enums.Edibility { return enums.Edibility(v) })),
		Hymenium:  distinct(fn.Map(values["hymenium[]"], func(v string) enums.HymeniumType { return enums.HymeniumType(v) })),
		CapShape:  distinct(fn.Map(values["capShape[]"], func(v string) enums.CapShape { return enums.CapShape(v) })),
		Terms:     distinct(terms),
		Months:    distinct(months),
		Colours:   colours,
		Sizes:     sizes,
	}, nil
}

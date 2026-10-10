package catalog

import (
	"bytes"
	"encoding/json"
	"maps"
	"slices"
	"strconv"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// forecastValue is the only value of the axis forecast.
const forecastValue = "on"

// sizeKey names one measured length of a body part.
type sizeKey struct {
	Part      enums.BodyPart
	Dimension enums.Dimension
}

// span is a closed range of a measurement.
type span struct{ Low, High float64 }

// bound is a range of a query. A nil side is open.
type bound struct{ Low, High *float64 }

// period is the months of a fruiting period. Start after End wraps the year.
type period struct{ Start, End int }

// Facets are the values of a species that the filter can match.
type Facets struct {
	Edibility    enums.Edibility
	Hymenium     *enums.HymeniumType
	CapShapes    []enums.CapShape
	Colours      []partColours
	Measurements map[sizeKey]span
	Period       *period
	TermIDs      map[db.ID]struct{}
	Protection   enums.Protection
	Forecast     bool
	GenusName    string
	FamilyName   *string
	Senses       []string
	Trees        []string
}

// partColours holds the nearest standard keys of the colours of one part.
type partColours struct {
	Part enums.BodyPart
	Keys []string
}

// Selection is the filter of the species list.
type Selection struct {
	Edibility []enums.Edibility
	Hymenium  []enums.HymeniumType
	CapShape  []enums.CapShape
	Terms     []db.ID
	Months    []int
	Colours   map[enums.BodyPart]string
	Sizes     map[sizeKey]bound
}

func monthInPeriod(p *period, month int) bool {
	if p == nil {
		return false
	}
	if p.Start <= p.End {
		return p.Start <= month && month <= p.End
	}
	return month >= p.Start || month <= p.End
}

func (f Facets) coloursOf(part enums.BodyPart) []string {
	found, _ := fn.Find(f.Colours, func(c partColours) bool { return c.Part == part })
	return found.Keys
}

// Match tells if the species agrees with each axis of the selection.
func Match(f Facets, s Selection) bool {
	checks := []func() bool{
		func() bool { return len(s.Edibility) == 0 || slices.Contains(s.Edibility, f.Edibility) },
		func() bool {
			return len(s.Hymenium) == 0 || (f.Hymenium != nil && slices.Contains(s.Hymenium, *f.Hymenium))
		},
		func() bool {
			return len(s.CapShape) == 0 || fn.Any(f.CapShapes, func(c enums.CapShape) bool { return slices.Contains(s.CapShape, c) })
		},
		func() bool {
			return fn.All(s.Terms, func(id db.ID) bool { _, ok := f.TermIDs[id]; return ok })
		},
		func() bool {
			return len(s.Months) == 0 || fn.Any(s.Months, func(m int) bool { return monthInPeriod(f.Period, m) })
		},
		func() bool {
			return fn.All(fn.SortedKeys(s.Colours), func(part enums.BodyPart) bool {
				return slices.Contains(f.coloursOf(part), Nearest(s.Colours[part]).Key)
			})
		},
		func() bool {
			return fn.All(slices.Collect(maps.Keys(s.Sizes)), func(key sizeKey) bool {
				measured, ok := f.Measurements[key]
				q := s.Sizes[key]
				return ok && (q.Low == nil || measured.High >= *q.Low) && (q.High == nil || measured.Low <= *q.High)
			})
		},
	}
	return fn.All(checks, func(check func() bool) bool { return check() })
}

// Counts is a JSON object of counts that keeps the order of first use.
type Counts struct {
	keys   []string
	values map[string]int
}

func newCounts() *Counts { return &Counts{values: map[string]int{}} }

func (c *Counts) add(key string, n int) {
	if _, ok := c.values[key]; !ok {
		c.keys = append(c.keys, key)
	}
	c.values[key] += n
}

// Get gives the count of a key.
func (c *Counts) Get(key string) int { return c.values[key] }

// MarshalJSON writes the keys in the order of first use.
func (c *Counts) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, key := range c.keys {
		if i > 0 {
			b.WriteByte(',')
		}
		name, err := json.Marshal(key)
		if err != nil {
			return nil, err
		}
		b.Write(name)
		b.WriteByte(':')
		b.WriteString(strconv.Itoa(c.values[key]))
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

// Axes is a JSON object of axes that keeps the order of first use.
type Axes struct {
	keys   []string
	values map[string]*Counts
}

func (a *Axes) axis(name string) *Counts {
	if found, ok := a.values[name]; ok {
		return found
	}
	made := newCounts()
	a.keys = append(a.keys, name)
	a.values[name] = made
	return made
}

// Axis gives the counts of an axis, or nil.
func (a *Axes) Axis(name string) *Counts { return a.values[name] }

// MarshalJSON writes the axes in the order of first use.
func (a *Axes) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, key := range a.keys {
		if i > 0 {
			b.WriteByte(',')
		}
		name, err := json.Marshal(key)
		if err != nil {
			return nil, err
		}
		body, err := a.values[key].MarshalJSON()
		if err != nil {
			return nil, err
		}
		b.Write(name)
		b.WriteByte(':')
		b.Write(body)
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

type axisValues struct {
	name   string
	values []string
}

func valuesOf(f Facets) []axisValues {
	months := fn.Map(fn.Filter([]int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12},
		func(m int) bool { return monthInPeriod(f.Period, m) }), strconv.Itoa)
	hymenium := []string{}
	if f.Hymenium != nil {
		hymenium = []string{string(*f.Hymenium)}
	}
	forecast := []string{}
	if f.Forecast {
		forecast = []string{forecastValue}
	}
	names := []string{}
	if f.GenusName != "" {
		names = append(names, f.GenusName)
	}
	if f.FamilyName != nil && *f.FamilyName != "" {
		names = append(names, *f.FamilyName)
	}
	return []axisValues{
		{"edibility", []string{string(f.Edibility)}},
		{"hymenium", hymenium},
		{"capShape", slices.Sorted(slices.Values(fn.Map(f.CapShapes, func(c enums.CapShape) string { return string(c) })))},
		{"protection", []string{string(f.Protection)}},
		{"forecast", forecast},
		{"period", months},
		{"senses", slices.Sorted(slices.Values(f.Senses))},
		{"treePartner", slices.Sorted(slices.Values(f.Trees))},
		{"genusFamily", names},
	}
}

// Catalogue counts for each axis how many species have each value. The
// axis "unknown" counts the species without a value on an axis.
func Catalogue(species []Facets) *Axes {
	axes := &Axes{values: map[string]*Counts{}}
	unknown := newCounts()
	for _, entry := range species {
		for _, axis := range valuesOf(entry) {
			switch {
			case len(axis.values) > 0:
				counts := axes.axis(axis.name)
				for _, value := range axis.values {
					counts.add(value, 1)
				}
			case axis.name != "forecast":
				unknown.add(axis.name, 1)
			}
		}
		for _, part := range entry.Colours {
			counts := axes.axis("colour." + string(part.Part))
			for _, key := range part.Keys {
				counts.add(key, 1)
			}
		}
	}
	if len(unknown.keys) > 0 {
		axes.keys = append(axes.keys, "unknown")
		axes.values["unknown"] = unknown
	}
	return axes
}

// facetsOf builds the filter values of a species from its child rows.
func facetsOf(s speciesRow, c children, terms map[db.ID]termRow, names taxonNames) Facets {
	own := c.colours[s.ID]
	colours := fn.Map(c.colourRanges[s.ID], func(r colourRangeRow) partColours {
		keys := fn.Map(fn.Filter(own, func(x colourRow) bool { return x.Part == r.Part }),
			func(x colourRow) string { return Nearest(x.Hex).Key })
		return partColours{Part: r.Part, Keys: slices.Compact(slices.Sorted(slices.Values(keys)))}
	})
	measurements := fn.Reduce(c.measurements[s.ID], map[sizeKey]span{}, func(acc map[sizeKey]span, m measurementRow) map[sizeKey]span {
		acc[sizeKey{m.Part, m.Dimension}] = span{m.Low, m.High}
		return acc
	})
	var p *period
	if s.PeriodStartMonth != nil && s.PeriodEndMonth != nil {
		p = &period{*s.PeriodStartMonth, *s.PeriodEndMonth}
	}
	termIDs := fn.Set(fn.Map(c.terms[s.ID], func(r speciesTermRow) db.ID { return r.TermID }))
	held := fn.FlatMap(fn.SortedBy(slices.Collect(maps.Keys(termIDs)), func(id db.ID) string { return id.String() }), func(id db.ID) []termRow {
		if t, ok := terms[id]; ok {
			return []termRow{t}
		}
		return nil
	})
	slugsOf := func(keep func(termRow) bool) []string {
		return slices.Compact(slices.Sorted(slices.Values(fn.Map(fn.Filter(held, keep), func(t termRow) string { return t.Slug }))))
	}
	shapes := fn.FlatMap([]*enums.CapShape{s.CapShapeYoung, s.CapShapeOld}, func(c *enums.CapShape) []enums.CapShape {
		if c == nil {
			return nil
		}
		return []enums.CapShape{*c}
	})
	genus, family := names.of(s)
	return Facets{
		Edibility:    s.Edibility,
		Hymenium:     s.HymeniumType,
		CapShapes:    slices.Compact(slices.Sorted(slices.Values(shapes))),
		Colours:      colours,
		Measurements: measurements,
		Period:       p,
		TermIDs:      termIDs,
		Protection:   s.Protection,
		Forecast:     s.ForecastEnabled,
		GenusName:    genus,
		FamilyName:   family,
		Senses: slugsOf(func(t termRow) bool {
			return t.Kind == enums.TermKindSmell || t.Kind == enums.TermKindTaste
		}),
		Trees: slugsOf(func(t termRow) bool { return t.Kind == enums.TermKindTree }),
	}
}

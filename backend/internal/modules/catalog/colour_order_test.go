package catalog

import (
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

func TestColourGroupsFollowTheBodyOrder(t *testing.T) {
	id := db.NewID()
	parts := []enums.BodyPart{enums.BodyPartCap, enums.BodyPartFlesh, enums.BodyPartSporePrint, enums.BodyPartStem, enums.BodyPartTubes}
	c := children{
		colourRanges: map[db.ID][]colourRangeRow{id: fn.Map(parts, func(p enums.BodyPart) colourRangeRow {
			return colourRangeRow{SpeciesID: id, Part: p, Mode: enums.ColourMode("any")}
		})},
		colours: map[db.ID][]colourRow{id: fn.Map(parts, func(p enums.BodyPart) colourRow {
			return colourRow{SpeciesID: id, Part: p, Name: "weiß", Hex: "#ffffff"}
		})},
	}
	got := fn.Map(colourGroups(id, c), func(g ColourGroup) enums.BodyPart { return g.Part })
	want := []enums.BodyPart{enums.BodyPartCap, enums.BodyPartStem, enums.BodyPartTubes, enums.BodyPartFlesh, enums.BodyPartSporePrint}
	if !slices.Equal(got, want) {
		t.Fatalf("%v", got)
	}
}

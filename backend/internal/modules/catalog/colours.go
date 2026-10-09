package catalog

import (
	"math"
	"slices"
	"strconv"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
)

// bodyOrder is the order of the parts on a species page: from the top of the fruit body down, then the inside.
var bodyOrder = []enums.BodyPart{
	enums.BodyPartFruitbody, enums.BodyPartCap, enums.BodyPartStem, enums.BodyPartRing, enums.BodyPartStemBase,
	enums.BodyPartGills, enums.BodyPartTubes, enums.BodyPartPores, enums.BodyPartFlesh, enums.BodyPartSporePrint, enums.BodyPartSpore,
}

// BodyRank gives the place of a part in the page order. An unknown part goes last.
func BodyRank(part enums.BodyPart) int {
	if index := slices.Index(bodyOrder, part); index >= 0 {
		return index
	}
	return len(bodyOrder)
}

// StandardColour is one colour of the filter palette.
type StandardColour struct {
	Key string `json:"key"`
	Hex string `json:"hex"`
}

// Standard holds the twelve colours of the board FilterColour, in its order.
var Standard = []StandardColour{
	{"white", "#f3efe6"},
	{"cream", "#e8d9b5"},
	{"yellow", "#e0b446"},
	{"orange", "#d1832f"},
	{"redBrown", "#a0522d"},
	{"brown", "#6b4423"},
	{"darkBrown", "#3e2a17"},
	{"olive", "#7f8a3a"},
	{"green", "#4f7a3a"},
	{"red", "#b8322a"},
	{"violet", "#7a3b6a"},
	{"grey", "#8a8f8a"},
}

const gammaCut = 0.04045

// The chroma axes count double: hue tells more than lightness.
var weights = [3]float64{1, 2, 2}

func channels(value string) [3]float64 {
	raw := strings.TrimLeft(value, "#")
	out := [3]float64{}
	for i := range out {
		if len(raw) < 2*i+2 {
			break
		}
		part, _ := strconv.ParseUint(raw[2*i:2*i+2], 16, 8)
		out[i] = float64(part) / 255
	}
	return out
}

func linear(value float64) float64 {
	if value <= gammaCut {
		return value / 12.92
	}
	return math.Pow((value+0.055)/1.055, 2.4)
}

// Oklab gives the colour in the Oklab space.
func Oklab(value string) [3]float64 {
	c := channels(value)
	red, green, blue := linear(c[0]), linear(c[1]), linear(c[2])
	long := 0.4122214708*red + 0.5363325363*green + 0.0514459929*blue
	medium := 0.2119034982*red + 0.6806995451*green + 0.1073969566*blue
	short := 0.0883024619*red + 0.2817188376*green + 0.6299787005*blue
	l, m, s := math.Pow(long, 1.0/3.0), math.Pow(medium, 1.0/3.0), math.Pow(short, 1.0/3.0)
	return [3]float64{
		0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
		1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
		0.0259040371*l + 0.7827717662*m - 0.8086757660*s,
	}
}

// Distance is the weighted distance of two colours in the Oklab space.
func Distance(first, second string) float64 {
	left, right := Oklab(first), Oklab(second)
	sum := 0.0
	for i := range left {
		d := (left[i] - right[i]) * weights[i]
		sum += d * d
	}
	return math.Sqrt(sum)
}

// Nearest gives the standard colour nearest to a catalogue colour. A tie
// goes to the first colour of the palette.
func Nearest(value string) StandardColour {
	return slices.MinFunc(Standard, func(a, b StandardColour) int {
		da, dbb := Distance(value, a.Hex), Distance(value, b.Hex)
		switch {
		case da < dbb:
			return -1
		case da > dbb:
			return 1
		default:
			return 0
		}
	})
}

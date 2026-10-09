// Package enums holds the value sets of the API and the database.
// The values are the stored and the JSON form.
package enums

import "slices"

// Area is a value of the set Area.
type Area string

// The values of Area.
const (
	AreaSpecies   Area = "species"
	AreaInterface Area = "interface"
	AreaAccess    Area = "access"
	AreaData      Area = "data"
)

// AreaValues lists each value of Area in declaration order.
var AreaValues = []Area{"species", "interface", "access", "data"}

// Valid tells if the value is in the set.
func (v Area) Valid() bool { return slices.Contains(AreaValues, v) }

// BodyPart is a value of the set BodyPart.
type BodyPart string

// The values of BodyPart.
const (
	BodyPartFruitbody  BodyPart = "fruitbody"
	BodyPartCap        BodyPart = "cap"
	BodyPartStem       BodyPart = "stem"
	BodyPartRing       BodyPart = "ring"
	BodyPartStemBase   BodyPart = "stem_base"
	BodyPartGills      BodyPart = "gills"
	BodyPartFlesh      BodyPart = "flesh"
	BodyPartSporePrint BodyPart = "spore_print"
	BodyPartSpore      BodyPart = "spore"
	BodyPartTubes      BodyPart = "tubes"
	BodyPartPores      BodyPart = "pores"
)

// BodyPartValues lists each value of BodyPart in declaration order.
var BodyPartValues = []BodyPart{"fruitbody", "cap", "stem", "ring", "stem_base", "gills", "flesh", "spore_print", "spore", "tubes", "pores"}

// Valid tells if the value is in the set.
func (v BodyPart) Valid() bool { return slices.Contains(BodyPartValues, v) }

// CapFeature is a value of the set CapFeature.
type CapFeature string

// The values of CapFeature.
const (
	CapFeatureUmbonate     CapFeature = "umbonate"
	CapFeatureHygrophanous CapFeature = "hygrophanous"
	CapFeatureZoned        CapFeature = "zoned"
	CapFeatureSunken       CapFeature = "sunken"
	CapFeatureIrregular    CapFeature = "irregular"
	CapFeatureNavelled     CapFeature = "navelled"
)

// CapFeatureValues lists each value of CapFeature in declaration order.
var CapFeatureValues = []CapFeature{"umbonate", "hygrophanous", "zoned", "sunken", "irregular", "navelled"}

// Valid tells if the value is in the set.
func (v CapFeature) Valid() bool { return slices.Contains(CapFeatureValues, v) }

// CapMargin is a value of the set CapMargin.
type CapMargin string

// The values of CapMargin.
const (
	CapMarginInrolled    CapMargin = "inrolled"
	CapMarginWavy        CapMargin = "wavy"
	CapMarginStriate     CapMargin = "striate"
	CapMarginCracked     CapMargin = "cracked"
	CapMarginFringed     CapMargin = "fringed"
	CapMarginIncurved    CapMargin = "incurved"
	CapMarginOverhanging CapMargin = "overhanging"
	CapMarginSharp       CapMargin = "sharp"
	CapMarginLobed       CapMargin = "lobed"
)

// CapMarginValues lists each value of CapMargin in declaration order.
var CapMarginValues = []CapMargin{"inrolled", "wavy", "striate", "cracked", "fringed", "incurved", "overhanging", "sharp", "lobed"}

// Valid tells if the value is in the set.
func (v CapMargin) Valid() bool { return slices.Contains(CapMarginValues, v) }

// CapShape is a value of the set CapShape.
type CapShape string

// The values of CapShape.
const (
	CapShapeHemispherical CapShape = "hemispherical"
	CapShapeConvex        CapShape = "convex"
	CapShapeFlat          CapShape = "flat"
	CapShapeDepressed     CapShape = "depressed"
	CapShapeFunnel        CapShape = "funnel"
	CapShapeConical       CapShape = "conical"
	CapShapeBell          CapShape = "bell"
	CapShapeEgg           CapShape = "egg"
	CapShapeSpherical     CapShape = "spherical"
	CapShapeShell         CapShape = "shell"
	CapShapePear          CapShape = "pear"
	CapShapeClub          CapShape = "club"
	CapShapeCylindrical   CapShape = "cylindrical"
)

// CapShapeValues lists each value of CapShape in declaration order.
var CapShapeValues = []CapShape{"hemispherical", "convex", "flat", "depressed", "funnel", "conical", "bell", "egg", "spherical", "shell", "pear", "club", "cylindrical"}

// Valid tells if the value is in the set.
func (v CapShape) Valid() bool { return slices.Contains(CapShapeValues, v) }

// ColourMode is a value of the set ColourMode.
type ColourMode string

// The values of ColourMode.
const (
	ColourModeSingle   ColourMode = "single"
	ColourModeGradient ColourMode = "gradient"
	ColourModeDistinct ColourMode = "distinct"
)

// ColourModeValues lists each value of ColourMode in declaration order.
var ColourModeValues = []ColourMode{"single", "gradient", "distinct"}

// Valid tells if the value is in the set.
func (v ColourMode) Valid() bool { return slices.Contains(ColourModeValues, v) }

// Condition is a value of the set Condition.
type Condition string

// The values of Condition.
const (
	ConditionBelow   Condition = "below"
	ConditionAbove   Condition = "above"
	ConditionBetween Condition = "between"
)

// ConditionValues lists each value of Condition in declaration order.
var ConditionValues = []Condition{"below", "above", "between"}

// Valid tells if the value is in the set.
func (v Condition) Valid() bool { return slices.Contains(ConditionValues, v) }

// Dimension is a value of the set Dimension.
type Dimension string

// The values of Dimension.
const (
	DimensionWidth     Dimension = "width"
	DimensionHeight    Dimension = "height"
	DimensionThickness Dimension = "thickness"
	DimensionLength    Dimension = "length"
)

// DimensionValues lists each value of Dimension in declaration order.
var DimensionValues = []Dimension{"width", "height", "thickness", "length"}

// Valid tells if the value is in the set.
func (v Dimension) Valid() bool { return slices.Contains(DimensionValues, v) }

// Edibility is a value of the set Edibility.
type Edibility string

// The values of Edibility.
const (
	EdibilityEdible              Edibility = "edible"
	EdibilityConditionallyEdible Edibility = "conditionally_edible"
	EdibilityInedible            Edibility = "inedible"
	EdibilityPoisonous           Edibility = "poisonous"
	EdibilityDeadly              Edibility = "deadly"
)

// EdibilityValues lists each value of Edibility in declaration order.
var EdibilityValues = []Edibility{"edible", "conditionally_edible", "inedible", "poisonous", "deadly"}

// Valid tells if the value is in the set.
func (v Edibility) Valid() bool { return slices.Contains(EdibilityValues, v) }

// Frequency is a value of the set Frequency.
type Frequency string

// The values of Frequency.
const (
	FrequencyVeryCommon Frequency = "very_common"
	FrequencyCommon     Frequency = "common"
	FrequencyScattered  Frequency = "scattered"
	FrequencyRare       Frequency = "rare"
	FrequencyVeryRare   Frequency = "very_rare"
)

// FrequencyValues lists each value of Frequency in declaration order.
var FrequencyValues = []Frequency{"very_common", "common", "scattered", "rare", "very_rare"}

// Valid tells if the value is in the set.
func (v Frequency) Valid() bool { return slices.Contains(FrequencyValues, v) }

// GillAttachment is a value of the set GillAttachment.
type GillAttachment string

// The values of GillAttachment.
const (
	GillAttachmentFree       GillAttachment = "free"
	GillAttachmentAdnate     GillAttachment = "adnate"
	GillAttachmentEmarginate GillAttachment = "emarginate"
	GillAttachmentDecurrent  GillAttachment = "decurrent"
)

// GillAttachmentValues lists each value of GillAttachment in declaration order.
var GillAttachmentValues = []GillAttachment{"free", "adnate", "emarginate", "decurrent"}

// Valid tells if the value is in the set.
func (v GillAttachment) Valid() bool { return slices.Contains(GillAttachmentValues, v) }

// GillEdge is a value of the set GillEdge.
type GillEdge string

// The values of GillEdge.
const (
	GillEdgeSmooth  GillEdge = "smooth"
	GillEdgeSerrate GillEdge = "serrate"
	GillEdgeCiliate GillEdge = "ciliate"
)

// GillEdgeValues lists each value of GillEdge in declaration order.
var GillEdgeValues = []GillEdge{"smooth", "serrate", "ciliate"}

// Valid tells if the value is in the set.
func (v GillEdge) Valid() bool { return slices.Contains(GillEdgeValues, v) }

// GillSpacing is a value of the set GillSpacing.
type GillSpacing string

// The values of GillSpacing.
const (
	GillSpacingClose   GillSpacing = "close"
	GillSpacingNormal  GillSpacing = "normal"
	GillSpacingDistant GillSpacing = "distant"
)

// GillSpacingValues lists each value of GillSpacing in declaration order.
var GillSpacingValues = []GillSpacing{"close", "normal", "distant"}

// Valid tells if the value is in the set.
func (v GillSpacing) Valid() bool { return slices.Contains(GillSpacingValues, v) }

// Group is a value of the set Group.
type Group string

// The values of Group.
const (
	GroupBolete             Group = "bolete"
	GroupRoughStemmedBolete Group = "rough_stemmed_bolete"
	GroupSlipperyJack       Group = "slippery_jack"
	GroupChanterelle        Group = "chanterelle"
	GroupHedgehog           Group = "hedgehog"
	GroupMilkcap            Group = "milkcap"
	GroupBrittlegill        Group = "brittlegill"
	GroupParasol            Group = "parasol"
	GroupAgaricus           Group = "agaricus"
	GroupInkcap             Group = "inkcap"
	GroupPuffball           Group = "puffball"
	GroupFunnel             Group = "funnel"
	GroupBlewit             Group = "blewit"
	GroupHoneyFungus        Group = "honey_fungus"
	GroupScalycap           Group = "scalycap"
	GroupToughshank         Group = "toughshank"
	GroupPorcelain          Group = "porcelain"
	GroupOyster             Group = "oyster"
	GroupLionsMane          Group = "lions_mane"
	GroupPolypore           Group = "polypore"
	GroupCauliflower        Group = "cauliflower"
	GroupKnight             Group = "knight"
	GroupParachute          Group = "parachute"
	GroupWoodwax            Group = "woodwax"
	GroupAmanita            Group = "amanita"
	GroupMorel              Group = "morel"
	GroupJellyEar           Group = "jelly_ear"
	GroupSpike              Group = "spike"
	GroupWebcap             Group = "webcap"
	GroupDomecap            Group = "domecap"
	GroupPinkgill           Group = "pinkgill"
	GroupSpineFungus        Group = "spine_fungus"
	GroupCupFungus          Group = "cup_fungus"
)

// GroupValues lists each value of Group in declaration order.
var GroupValues = []Group{"bolete", "rough_stemmed_bolete", "slippery_jack", "chanterelle", "hedgehog", "milkcap", "brittlegill", "parasol", "agaricus", "inkcap", "puffball", "funnel", "blewit", "honey_fungus", "scalycap", "toughshank", "porcelain", "oyster", "lions_mane", "polypore", "cauliflower", "knight", "parachute", "woodwax", "amanita", "morel", "jelly_ear", "spike", "webcap", "domecap", "pinkgill", "spine_fungus", "cup_fungus"}

// Valid tells if the value is in the set.
func (v Group) Valid() bool { return slices.Contains(GroupValues, v) }

// HymeniumType is a value of the set HymeniumType.
type HymeniumType string

// The values of HymeniumType.
const (
	HymeniumTypeGills  HymeniumType = "gills"
	HymeniumTypeTubes  HymeniumType = "tubes"
	HymeniumTypePores  HymeniumType = "pores"
	HymeniumTypeSpines HymeniumType = "spines"
	HymeniumTypeFolds  HymeniumType = "folds"
)

// HymeniumTypeValues lists each value of HymeniumType in declaration order.
var HymeniumTypeValues = []HymeniumType{"gills", "tubes", "pores", "spines", "folds"}

// Valid tells if the value is in the set.
func (v HymeniumType) Valid() bool { return slices.Contains(HymeniumTypeValues, v) }

// Licence is a value of the set Licence.
type Licence string

// The values of Licence.
const (
	LicenceOwn          Licence = "own"
	LicenceCc0          Licence = "cc0"
	LicenceCcBy4        Licence = "cc_by_4"
	LicenceCcBySa4      Licence = "cc_by_sa_4"
	LicencePublicDomain Licence = "public_domain"
)

// LicenceValues lists each value of Licence in declaration order.
var LicenceValues = []Licence{"own", "cc0", "cc_by_4", "cc_by_sa_4", "public_domain"}

// Valid tells if the value is in the set.
func (v Licence) Valid() bool { return slices.Contains(LicenceValues, v) }

// MarkerColour is a value of the set MarkerColour.
type MarkerColour string

// The values of MarkerColour.
const (
	MarkerColourGreen  MarkerColour = "green"
	MarkerColourYellow MarkerColour = "yellow"
	MarkerColourOrange MarkerColour = "orange"
	MarkerColourRed    MarkerColour = "red"
	MarkerColourViolet MarkerColour = "violet"
	MarkerColourGrey   MarkerColour = "grey"
)

// MarkerColourValues lists each value of MarkerColour in declaration order.
var MarkerColourValues = []MarkerColour{"green", "yellow", "orange", "red", "violet", "grey"}

// Valid tells if the value is in the set.
func (v MarkerColour) Valid() bool { return slices.Contains(MarkerColourValues, v) }

// NameKind is a value of the set NameKind.
type NameKind string

// The values of NameKind.
const (
	NameKindCommon  NameKind = "common"
	NameKindSynonym NameKind = "synonym"
)

// NameKindValues lists each value of NameKind in declaration order.
var NameKindValues = []NameKind{"common", "synonym"}

// Valid tells if the value is in the set.
func (v NameKind) Valid() bool { return slices.Contains(NameKindValues, v) }

// Phase is a value of the set Phase.
type Phase string

// The values of Phase.
const (
	PhaseYoung Phase = "young"
	PhaseOld   Phase = "old"
)

// PhaseValues lists each value of Phase in declaration order.
var PhaseValues = []Phase{"young", "old"}

// Valid tells if the value is in the set.
func (v Phase) Valid() bool { return slices.Contains(PhaseValues, v) }

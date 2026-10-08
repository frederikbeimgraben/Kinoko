// Package enums holds the value sets of the API and the database.
// The values are the stored and the JSON form.
package enums

import "slices"

// Area is a value of the set Area.
type Area string

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

const (
	MarkerColourGreen MarkerColour = "green"
	MarkerColourBrown MarkerColour = "brown"
	MarkerColourBlue  MarkerColour = "blue"
	MarkerColourRed   MarkerColour = "red"
	MarkerColourGold  MarkerColour = "gold"
	MarkerColourGrey  MarkerColour = "grey"
)

// MarkerColourValues lists each value of MarkerColour in declaration order.
var MarkerColourValues = []MarkerColour{"green", "brown", "blue", "red", "gold", "grey"}

// Valid tells if the value is in the set.
func (v MarkerColour) Valid() bool { return slices.Contains(MarkerColourValues, v) }

// NameKind is a value of the set NameKind.
type NameKind string

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

const (
	PhaseYoung Phase = "young"
	PhaseOld   Phase = "old"
)

// PhaseValues lists each value of Phase in declaration order.
var PhaseValues = []Phase{"young", "old"}

// Valid tells if the value is in the set.
func (v Phase) Valid() bool { return slices.Contains(PhaseValues, v) }

// PhotoSize is a value of the set PhotoSize.
type PhotoSize string

const (
	PhotoSizeThumb PhotoSize = "thumb"
	PhotoSizeList  PhotoSize = "list"
	PhotoSizeFull  PhotoSize = "full"
)

// PhotoSizeValues lists each value of PhotoSize in declaration order.
var PhotoSizeValues = []PhotoSize{"thumb", "list", "full"}

// Valid tells if the value is in the set.
func (v PhotoSize) Valid() bool { return slices.Contains(PhotoSizeValues, v) }

// PhotoState is a value of the set PhotoState.
type PhotoState string

const (
	PhotoStatePrivate   PhotoState = "private"
	PhotoStateSubmitted PhotoState = "submitted"
	PhotoStateApproved  PhotoState = "approved"
	PhotoStateRejected  PhotoState = "rejected"
)

// PhotoStateValues lists each value of PhotoState in declaration order.
var PhotoStateValues = []PhotoState{"private", "submitted", "approved", "rejected"}

// Valid tells if the value is in the set.
func (v PhotoState) Valid() bool { return slices.Contains(PhotoStateValues, v) }

// Protection is a value of the set Protection.
type Protection string

const (
	ProtectionNone        Protection = "none"
	ProtectionPersonalUse Protection = "personal_use"
	ProtectionStrict      Protection = "strict"
)

// ProtectionValues lists each value of Protection in declaration order.
var ProtectionValues = []Protection{"none", "personal_use", "strict"}

// Valid tells if the value is in the set.
func (v Protection) Valid() bool { return slices.Contains(ProtectionValues, v) }

// RedListStatus is a value of the set RedListStatus.
type RedListStatus string

const (
	RedListStatusCriticallyEndangered RedListStatus = "critically_endangered"
	RedListStatusEndangered           RedListStatus = "endangered"
	RedListStatusVulnerable           RedListStatus = "vulnerable"
	RedListStatusUnknownExtent        RedListStatus = "unknown_extent"
	RedListStatusExtremelyRare        RedListStatus = "extremely_rare"
	RedListStatusNearThreatened       RedListStatus = "near_threatened"
	RedListStatusDataDeficient        RedListStatus = "data_deficient"
)

// RedListStatusValues lists each value of RedListStatus in declaration order.
var RedListStatusValues = []RedListStatus{"critically_endangered", "endangered", "vulnerable", "unknown_extent", "extremely_rare", "near_threatened", "data_deficient"}

// Valid tells if the value is in the set.
func (v RedListStatus) Valid() bool { return slices.Contains(RedListStatusValues, v) }

// ReviewDecision is a value of the set ReviewDecision.
type ReviewDecision string

const (
	ReviewDecisionAccepted ReviewDecision = "accepted"
	ReviewDecisionRejected ReviewDecision = "rejected"
)

// ReviewDecisionValues lists each value of ReviewDecision in declaration order.
var ReviewDecisionValues = []ReviewDecision{"accepted", "rejected"}

// Valid tells if the value is in the set.
func (v ReviewDecision) Valid() bool { return slices.Contains(ReviewDecisionValues, v) }

// ReviewState is a value of the set ReviewState.
type ReviewState string

const (
	ReviewStateOpen     ReviewState = "open"
	ReviewStateAccepted ReviewState = "accepted"
	ReviewStateRejected ReviewState = "rejected"
)

// ReviewStateValues lists each value of ReviewState in declaration order.
var ReviewStateValues = []ReviewState{"open", "accepted", "rejected"}

// Valid tells if the value is in the set.
func (v ReviewState) Valid() bool { return slices.Contains(ReviewStateValues, v) }

// Rule is a value of the set Rule.
type Rule string

const (
	RuleIntersection Rule = "intersection"
	RuleGraded       Rule = "graded"
)

// RuleValues lists each value of Rule in declaration order.
var RuleValues = []Rule{"intersection", "graded"}

// Valid tells if the value is in the set.
func (v Rule) Valid() bool { return slices.Contains(RuleValues, v) }

// RunKind is a value of the set RunKind.
type RunKind string

const (
	RunKindTraining RunKind = "training"
	RunKindRender   RunKind = "render"
	RunKindFull     RunKind = "full"
)

// RunKindValues lists each value of RunKind in declaration order.
var RunKindValues = []RunKind{"training", "render", "full"}

// Valid tells if the value is in the set.
func (v RunKind) Valid() bool { return slices.Contains(RunKindValues, v) }

// RunState is a value of the set RunState.
type RunState string

const (
	RunStateQueued   RunState = "queued"
	RunStateRunning  RunState = "running"
	RunStateFinished RunState = "finished"
	RunStateFailed   RunState = "failed"
)

// RunStateValues lists each value of RunState in declaration order.
var RunStateValues = []RunState{"queued", "running", "finished", "failed"}

// Valid tells if the value is in the set.
func (v RunState) Valid() bool { return slices.Contains(RunStateValues, v) }

// Season is a value of the set Season.
type Season string

const (
	SeasonSpring Season = "spring"
	SeasonSummer Season = "summer"
	SeasonAutumn Season = "autumn"
	SeasonWinter Season = "winter"
)

// SeasonValues lists each value of Season in declaration order.
var SeasonValues = []Season{"spring", "summer", "autumn", "winter"}

// Valid tells if the value is in the set.
func (v Season) Valid() bool { return slices.Contains(SeasonValues, v) }

// SourceScope is a value of the set SourceScope.
type SourceScope string

const (
	SourceScopeProfile SourceScope = "profile"
	SourceScopeFurther SourceScope = "further"
)

// SourceScopeValues lists each value of SourceScope in declaration order.
var SourceScopeValues = []SourceScope{"profile", "further"}

// Valid tells if the value is in the set.
func (v SourceScope) Valid() bool { return slices.Contains(SourceScopeValues, v) }

// Speed is a value of the set Speed.
type Speed string

const (
	SpeedImmediate     Speed = "immediate"
	SpeedThirtySeconds Speed = "30s"
	SpeedOneMinute     Speed = "1min"
	SpeedThreeMinutes  Speed = "3min"
	SpeedLonger        Speed = "longer"
	SpeedPermanent     Speed = "permanent"
)

// SpeedValues lists each value of Speed in declaration order.
var SpeedValues = []Speed{"immediate", "30s", "1min", "3min", "longer", "permanent"}

// Valid tells if the value is in the set.
func (v Speed) Valid() bool { return slices.Contains(SpeedValues, v) }

// StemFeature is a value of the set StemFeature.
type StemFeature string

const (
	StemFeatureRing    StemFeature = "ring"
	StemFeatureBulb    StemFeature = "bulb"
	StemFeatureHollow  StemFeature = "hollow"
	StemFeatureFibrous StemFeature = "fibrous"
	StemFeatureFlocked StemFeature = "flocked"
	StemFeatureSolid   StemFeature = "solid"
	StemFeatureBanded  StemFeature = "banded"
	StemFeatureNetted  StemFeature = "netted"
	StemFeatureHairy   StemFeature = "hairy"
	StemFeatureRooting StemFeature = "rooting"
	StemFeatureStriate StemFeature = "striate"
	StemFeatureVolva   StemFeature = "volva"
	StemFeatureBrittle StemFeature = "brittle"
)

// StemFeatureValues lists each value of StemFeature in declaration order.
var StemFeatureValues = []StemFeature{"ring", "bulb", "hollow", "fibrous", "flocked", "solid", "banded", "netted", "hairy", "rooting", "striate", "volva", "brittle"}

// Valid tells if the value is in the set.
func (v StemFeature) Valid() bool { return slices.Contains(StemFeatureValues, v) }

// TaxonRank is a value of the set TaxonRank.
type TaxonRank string

const (
	TaxonRankDivision TaxonRank = "division"
	TaxonRankClass    TaxonRank = "class"
	TaxonRankOrder    TaxonRank = "order"
	TaxonRankFamily   TaxonRank = "family"
	TaxonRankGenus    TaxonRank = "genus"
)

// TaxonRankValues lists each value of TaxonRank in declaration order.
var TaxonRankValues = []TaxonRank{"division", "class", "order", "family", "genus"}

// Valid tells if the value is in the set.
func (v TaxonRank) Valid() bool { return slices.Contains(TaxonRankValues, v) }

// TermKind is a value of the set TermKind.
type TermKind string

const (
	TermKindSmell   TermKind = "smell"
	TermKindTaste   TermKind = "taste"
	TermKindTree    TermKind = "tree"
	TermKindTrigger TermKind = "trigger"
)

// TermKindValues lists each value of TermKind in declaration order.
var TermKindValues = []TermKind{"smell", "taste", "tree", "trigger"}

// Valid tells if the value is in the set.
func (v TermKind) Valid() bool { return slices.Contains(TermKindValues, v) }

// TraitKey is a value of the set TraitKey.
type TraitKey string

const (
	TraitKeyFruitbody  TraitKey = "fruitbody"
	TraitKeyCap        TraitKey = "cap"
	TraitKeyTubes      TraitKey = "tubes"
	TraitKeyGills      TraitKey = "gills"
	TraitKeyFolds      TraitKey = "folds"
	TraitKeySpines     TraitKey = "spines"
	TraitKeyPores      TraitKey = "pores"
	TraitKeyMilk       TraitKey = "milk"
	TraitKeyStem       TraitKey = "stem"
	TraitKeyFlesh      TraitKey = "flesh"
	TraitKeySmell      TraitKey = "smell"
	TraitKeyTaste      TraitKey = "taste"
	TraitKeySporePrint TraitKey = "spore_print"
	TraitKeyReagents   TraitKey = "reagents"
	TraitKeyHabitat    TraitKey = "habitat"
	TraitKeySeason     TraitKey = "season"
	TraitKeyEdibility  TraitKey = "edibility"
	TraitKeyProtection TraitKey = "protection"
)

// TraitKeyValues lists each value of TraitKey in declaration order.
var TraitKeyValues = []TraitKey{"fruitbody", "cap", "tubes", "gills", "folds", "spines", "pores", "milk", "stem", "flesh", "smell", "taste", "spore_print", "reagents", "habitat", "season", "edibility", "protection"}

// Valid tells if the value is in the set.
func (v TraitKey) Valid() bool { return slices.Contains(TraitKeyValues, v) }

// TriggerGroup is a value of the set TriggerGroup.
type TriggerGroup string

const (
	TriggerGroupMechanical  TriggerGroup = "mechanical"
	TriggerGroupReagent     TriggerGroup = "reagent"
	TriggerGroupEnvironment TriggerGroup = "environment"
)

// TriggerGroupValues lists each value of TriggerGroup in declaration order.
var TriggerGroupValues = []TriggerGroup{"mechanical", "reagent", "environment"}

// Valid tells if the value is in the set.
func (v TriggerGroup) Valid() bool { return slices.Contains(TriggerGroupValues, v) }

// Unit is a value of the set Unit.
type Unit string

const (
	UnitCm Unit = "cm"
	UnitMm Unit = "mm"
	UnitUm Unit = "um"
)

// UnitValues lists each value of Unit in declaration order.
var UnitValues = []Unit{"cm", "mm", "um"}

// Valid tells if the value is in the set.
func (v Unit) Valid() bool { return slices.Contains(UnitValues, v) }

// Visibility is a value of the set Visibility.
type Visibility string

const (
	VisibilityPrivate Visibility = "private"
	VisibilityShared  Visibility = "shared"
)

// VisibilityValues lists each value of Visibility in declaration order.
var VisibilityValues = []Visibility{"private", "shared"}

// Valid tells if the value is in the set.
func (v Visibility) Valid() bool { return slices.Contains(VisibilityValues, v) }

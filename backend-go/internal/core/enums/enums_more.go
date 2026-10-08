package enums

import "slices"

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
	RunKindFetch    RunKind = "fetch"
)

// RunKindValues lists each value of RunKind in declaration order.
var RunKindValues = []RunKind{"training", "render", "full", "fetch"}

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

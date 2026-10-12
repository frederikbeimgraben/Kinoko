package runner

import (
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather/dwd"
)

// Step is one stage of a run. Its name goes to pipeline_run_step.
type Step string

// The steps of the runs. The names tell the stage, not a script.
const (
	StepInputs           Step = "check inputs"
	StepFetchWeather     Step = "fetch weather"
	StepFetchOccurrences Step = "fetch occurrences"
	StepFetchOutline     Step = "fetch outline"
	StepFetchTrees       Step = "fetch tree map"
	StepFetchDEM         Step = "fetch elevation model"
	StepFetchSoil        Step = "fetch soil"
	StepWeather          Step = "weather checkpoints"
	StepOccurrences      Step = "occurrences"
	StepTrain            Step = "train models"
	StepMaps             Step = "render maps"
	StepLayers           Step = "render layers"
	StepSeason           Step = "season table"
)

// siteSteps are the steps that fetch the site data, in the order of their
// processing: the tree map needs the outline, and the soil the elevation model.
var siteSteps = []Step{StepFetchOutline, StepFetchTrees, StepFetchDEM, StepFetchSoil}

// siteKind gives the kind of site data that a step fetches.
var siteKind = map[Step]sources.Kind{
	StepFetchOutline: sources.KindGermanyOutline,
	StepFetchTrees:   sources.KindTreeSpeciesMap,
	StepFetchDEM:     sources.KindDEM,
	StepFetchSoil:    sources.KindSoilGrids,
}

// SourceOccurrences is the remote source of the GBIF records in remote_cache_file.
const SourceOccurrences = "gbif-occurrences"

// PerSpecies tells if the step runs once for each species of the run.
// A failed species does not stop such a step; a failure of another step stops the run.
func (s Step) PerSpecies() bool { return s == StepTrain || s == StepMaps }

// fetchSteps gives the fetch steps of a request. A run without a request
// refreshes each source that the chain reads, then gets the site data that
// has no version yet.
func fetchSteps(req *sources.FetchRequest) []Step {
	if req == nil {
		return append([]Step{StepFetchWeather, StepFetchOccurrences}, siteSteps...)
	}
	switch req.Source {
	case dwd.SourceHyras, dwd.SourceSoil:
		return []Step{StepFetchWeather}
	case SourceOccurrences:
		return []Step{StepFetchOccurrences}
	}
	return []Step{Step("fetch " + req.Source)}
}

// Plan gives the steps of a run kind in order. The render steps follow the
// training, so a full run draws the maps with the new models.
func Plan(kind enums.RunKind, req *sources.FetchRequest) []Step {
	prepare := []Step{StepInputs, StepWeather, StepOccurrences}
	render := []Step{StepMaps, StepLayers, StepSeason}
	switch kind {
	case enums.RunKindFetch:
		return append([]Step{StepInputs}, fetchSteps(req)...)
	case enums.RunKindTraining:
		return append(prepare, StepTrain)
	case enums.RunKindRender:
		return append(prepare, render...)
	case enums.RunKindFull:
		return append(append(prepare, StepTrain), render...)
	}
	return []Step{StepInputs}
}

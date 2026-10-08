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
	StepWeather          Step = "weather checkpoints"
	StepOccurrences      Step = "occurrences"
	StepTrain            Step = "train models"
	StepMaps             Step = "render maps"
	StepLayers           Step = "render layers"
	StepSeason           Step = "season table"
)

// SourceOccurrences is the remote source of the GBIF records in remote_cache_file.
const SourceOccurrences = "gbif-occurrences"

// PerSpecies tells if the step runs once for each species of the run.
// A failed species does not stop such a step; a failure of another step stops the run.
func (s Step) PerSpecies() bool { return s == StepTrain || s == StepMaps }

// fetchSteps gives the fetch steps of a request. A run without a request
// refreshes each source that the chain reads.
func fetchSteps(req *sources.FetchRequest) []Step {
	if req == nil {
		return []Step{StepFetchWeather, StepFetchOccurrences}
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

package runner

import (
	"context"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/runs"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/model/fit"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/occ"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/render"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather"
)

// Species is one species of a run. Chain is the row in species_forecast, or
// sources.DefaultChain. A nil Chain fails in each species step.
type Species struct {
	ID    db.ID
	Slug  string
	Name  string
	Latin string
	Chain *sources.Chain
}

// Trained is the result of the training of one species.
// Brier is the calibrated out-of-fold Brier score of horizon 0, or nil.
type Trained struct {
	Records   int
	Brier     *float64
	VersionID db.ID
}

// Stages does the work of the steps. Chain is the implementation of the
// service; the tests use stubs. A stage writes its progress to the job log.
type Stages interface {
	FetchWeather(ctx context.Context, j *Job) error
	FetchOccurrences(ctx context.Context, j *Job) error
	Weather(ctx context.Context, j *Job) error
	Occurrences(ctx context.Context, j *Job) error
	Train(ctx context.Context, j *Job, sp Species) (Trained, error)
	RenderSpecies(ctx context.Context, j *Job, sp Species) error
	RenderLayers(ctx context.Context, j *Job) error
	Season(ctx context.Context, j *Job) error
}

// Job is the state of one run while it executes. The steps share it:
// the occurrence step sets Records, and the render steps read them.
type Job struct {
	Run runs.Run
	// Request holds the parameters of a fetch run, or nil.
	Request *sources.FetchRequest
	// Now is the time at the start of the run. Each stage uses it as "today".
	Now time.Time
	// Species are the species of the run, by name.
	Species []Species
	// Records are the occurrences that the occurrence step built.
	Records []occ.Record

	mu  sync.Mutex
	log io.Writer

	// The stages of Chain read these large inputs once per run and drop them when no later step needs them.
	trees    *fit.TreeScales
	grids    *render.Tables
	scales   *pio.Table
	cube     *weather.Cube
	cubeVars []string
	models   *runModels
}

// Printf writes one line with the time to the run log.
// The fetchers and the training take it as their logger.
func (j *Job) Printf(format string, args ...any) {
	if j.log == nil {
		return
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	// A failed log line must not stop the run.
	_, _ = fmt.Fprintf(j.log, "%s %s\n", time.Now().UTC().Format(time.TimeOnly), fmt.Sprintf(format, args...))
}

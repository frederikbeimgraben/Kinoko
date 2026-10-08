package runs

import (
	"context"
	"os"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// logTailLines is the count of log lines that the detail shows.
const logTailLines = 200

// Summary is the short view of a run.
type Summary struct {
	ID            db.ID          `json:"id"`
	Kind          enums.RunKind  `json:"kind"`
	State         enums.RunState `json:"state"`
	QueuedAt      db.Time        `json:"queuedAt"`
	StartedAt     *db.Time       `json:"startedAt"`
	FinishedAt    *db.Time       `json:"finishedAt"`
	TriggeredByID *db.ID         `json:"triggeredById"`
	SpeciesName   *string        `json:"speciesName"`
	SpeciesCount  int            `json:"speciesCount"`
	RecordCount   int            `json:"recordCount"`
	ProgressDone  int            `json:"progressDone"`
	ProgressTotal int            `json:"progressTotal"`
}

// SpeciesEntry is the state of one species in a run.
type SpeciesEntry struct {
	SpeciesID   db.ID  `json:"speciesId"`
	State       string `json:"state"`
	RecordCount int    `json:"recordCount"`
	FindCount   int    `json:"findCount"`
}

// StepEntry is the state of one step in a run.
type StepEntry struct {
	Position  int            `json:"position"`
	Name      string         `json:"name"`
	State     enums.RunState `json:"state"`
	DurationS *int           `json:"durationS"`
}

// Detail is a run with its species, steps and log tail.
type Detail struct {
	Summary
	LogPath             *string        `json:"logPath"`
	MetricBrier         *float64       `json:"metricBrier"`
	MetricBrierPrevious *float64       `json:"metricBrierPrevious"`
	Species             []SpeciesEntry `json:"species"`
	Steps               []StepEntry    `json:"steps"`
	LogTail             []string       `json:"logTail"`
}

// tally holds the counts of a run and the name of its only species.
type tally struct {
	species int
	records int
	name    *string
}

// summaryOf builds the short view. A run without species rows has a zero tally.
func summaryOf(run Run, t tally) Summary {
	return Summary{
		ID:            run.ID,
		Kind:          run.Kind,
		State:         run.State,
		QueuedAt:      run.QueuedAt,
		StartedAt:     run.StartedAt,
		FinishedAt:    run.FinishedAt,
		TriggeredByID: run.TriggeredByID,
		SpeciesName:   t.name,
		SpeciesCount:  t.species,
		RecordCount:   t.records,
		ProgressDone:  run.ProgressDone,
		ProgressTotal: run.ProgressTotal,
	}
}

type tallyRow struct {
	run         db.ID
	count       int
	records     int
	first, last *string
}

// tallies counts species and records per run and names a single species.
func tallies(ctx context.Context, q db.Querier, ids []db.ID) (map[db.ID]tally, error) {
	if len(ids) == 0 {
		return map[db.ID]tally{}, nil
	}
	rows, err := db.All(ctx, q, func(s db.Scanner) (tallyRow, error) {
		var r tallyRow
		return r, s.Scan(&r.run, &r.count, &r.records, &r.first, &r.last)
	}, `SELECT prs.run_id, count(*), coalesce(sum(prs.record_count), 0), min(species.name), max(species.name)
		FROM pipeline_run_species prs JOIN species ON species.id = prs.species_id
		WHERE prs.run_id IN (`+db.Placeholders(len(ids))+`)
		GROUP BY prs.run_id`, db.Args(ids)...)
	if err != nil {
		return nil, err
	}
	return fn.Reduce(rows, map[db.ID]tally{}, func(acc map[db.ID]tally, r tallyRow) map[db.ID]tally {
		acc[r.run] = tally{species: r.count, records: r.records, name: onlyName(r)}
		return acc
	}), nil
}

func onlyName(r tallyRow) *string {
	if r.count == 1 && r.first != nil && r.last != nil && *r.first == *r.last {
		return r.first
	}
	return nil
}

// detailOf reads the species, steps, previous Brier score and log tail of a run.
func detailOf(ctx context.Context, q db.Querier, run Run) (Detail, error) {
	counted, err := tallies(ctx, q, []db.ID{run.ID})
	if err != nil {
		return Detail{}, err
	}
	species, err := db.All(ctx, q, func(s db.Scanner) (SpeciesEntry, error) {
		var e SpeciesEntry
		return e, s.Scan(&e.SpeciesID, &e.State, &e.RecordCount, &e.FindCount)
	}, `SELECT species_id, state, record_count, find_count FROM pipeline_run_species WHERE run_id = ?`, run.ID)
	if err != nil {
		return Detail{}, err
	}
	steps, err := db.All(ctx, q, func(s db.Scanner) (StepEntry, error) {
		var e StepEntry
		return e, s.Scan(&e.Position, &e.Name, &e.State, &e.DurationS)
	}, `SELECT position, name, state, duration_s FROM pipeline_run_step WHERE run_id = ? ORDER BY position`, run.ID)
	if err != nil {
		return Detail{}, err
	}
	previous, err := previousMetric(ctx, q, run)
	if err != nil {
		return Detail{}, err
	}
	return Detail{
		Summary:             summaryOf(run, counted[run.ID]),
		LogPath:             run.LogPath,
		MetricBrier:         run.MetricBrier,
		MetricBrierPrevious: previous,
		Species:             species,
		Steps:               steps,
		LogTail:             logTail(run.LogPath, logTailLines),
	}, nil
}

// previousMetric reads the Brier score of the last finished run of the same
// kind that finished before this run.
func previousMetric(ctx context.Context, q db.Querier, run Run) (*float64, error) {
	query := `SELECT metric_brier FROM pipeline_run
		WHERE kind = ? AND id != ? AND state = ? AND metric_brier IS NOT NULL`
	args := []any{run.Kind, run.ID, enums.RunStateFinished}
	if run.FinishedAt != nil {
		query += " AND finished_at < ?"
		args = append(args, *run.FinishedAt)
	}
	value, found, err := db.Maybe(ctx, q, func(s db.Scanner) (*float64, error) {
		var v *float64
		return v, s.Scan(&v)
	}, query+" ORDER BY finished_at DESC LIMIT 1", args...)
	if err != nil || !found {
		return nil, err
	}
	return value, nil
}

// logTail gives the last lines of the log file. A missing path or file gives no lines.
func logTail(path *string, lines int) []string {
	if path == nil || *path == "" {
		return []string{}
	}
	info, err := os.Stat(*path)
	if err != nil || !info.Mode().IsRegular() {
		return []string{}
	}
	content, err := os.ReadFile(*path)
	if err != nil {
		return []string{}
	}
	all := splitLines(string(content))
	return all[max(0, len(all)-lines):]
}

// splitLines splits text at the line ends that Python's str.splitlines knows.
// A line end at the end of the text gives no empty last line.
func splitLines(text string) []string {
	out := []string{}
	var line strings.Builder
	runes := []rune(text)
	for i := 0; i < len(runes); i++ {
		switch runes[i] {
		case '\r':
			if i+1 < len(runes) && runes[i+1] == '\n' {
				i++
			}
			fallthrough
		case '\n', '\v', '\f', '\x1c', '\x1d', '\x1e', '\u0085', ' ', ' ':
			out = append(out, line.String())
			line.Reset()
		default:
			line.WriteRune(runes[i])
		}
	}
	if line.Len() > 0 {
		out = append(out, line.String())
	}
	return out
}

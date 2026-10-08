package runs

import (
	"math"
	"math/big"
	"path/filepath"
	"regexp"
	"strconv"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// These rules are those of tools/pipeline_worker.py: step i has the name of script i. A species state goes
// queued, running, then finished or failed. A run fails when one species fails.

var stages = map[enums.RunKind][]string{
	enums.RunKindTraining: {"run_all.sh"},
	enums.RunKindRender:   {"render_de.sh"},
	enums.RunKindFull:     {"run_all.sh", "render_de.sh"},
}

// ListScript is the chain script that lists the chain name of each species.
const ListScript = "run_all.sh"

// Stages gives the chain scripts of a run kind, in order. The step at
// position i has the name of script i.
func Stages(kind enums.RunKind) []string {
	return append([]string(nil), stages[kind]...)
}

// LogPath gives the log file of a run in the folder of the run logs.
func LogPath(dir string, run db.ID) string {
	return filepath.Join(dir, run.String()+".log")
}

var (
	recordsPattern = regexp.MustCompile(`(?m)^visits with weather:\s*(\d+)`)
	brierPattern   = regexp.MustCompile(`(?m)^Brier score\s+raw\s+[\d.]+\s+calibrated\s+([\d.]+)`)
)

// RecordsIn gives the record count from the output of a stage: the last
// "visits with weather" line, else 0.
func RecordsIn(output string) int {
	found := recordsPattern.FindAllStringSubmatch(output, -1)
	if len(found) == 0 {
		return 0
	}
	n, err := strconv.Atoi(found[len(found)-1][1])
	if err != nil {
		return 0
	}
	return n
}

// BrierIn gives the calibrated Brier score from the output of a stage: the
// last "Brier score" line, else nil.
func BrierIn(output string) *float64 {
	found := brierPattern.FindAllStringSubmatch(output, -1)
	if len(found) == 0 {
		return nil
	}
	value, err := strconv.ParseFloat(found[len(found)-1][1], 64)
	if err != nil {
		return nil
	}
	return &value
}

// MeanBrier gives the Brier score of a run: the mean of the species scores,
// else nil. Python's statistics.mean adds exact fractions and rounds once,
// so the sum is exact here too.
func MeanBrier(scores []float64) *float64 {
	if len(scores) == 0 {
		return nil
	}
	if !fn.All(scores, isFinite) {
		mean := fn.Reduce(scores, 0.0, func(sum, s float64) float64 { return sum + s }) / float64(len(scores))
		return &mean
	}
	sum := fn.Reduce(scores, new(big.Rat), func(sum *big.Rat, s float64) *big.Rat {
		return sum.Add(sum, new(big.Rat).SetFloat64(s))
	})
	mean, _ := sum.Quo(sum, big.NewRat(int64(len(scores)), 1)).Float64()
	return &mean
}

func isFinite(x float64) bool { return !math.IsNaN(x) && !math.IsInf(x, 0) }

// EndState gives the state of a step or a run: failed when a species failed.
func EndState(failed bool) enums.RunState {
	if failed {
		return enums.RunStateFailed
	}
	return enums.RunStateFinished
}

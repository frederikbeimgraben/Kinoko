package dwd

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/pio"
)

// TestFetcherStopsStalledDownload checks that a transfer without bytes
// fails after Idle and does not block the fetch.
func TestFetcherStopsStalledDownload(t *testing.T) {
	fake, f, _ := setup(t)
	f.Attempts, f.Idle = 1, 500*time.Millisecond
	fake.stalled["/hyras_de/precipitation/pr_hyras_1_2026_v6-0_de.nc"] = true
	done := make(chan Result, 1)
	go func() {
		res, _ := f.Hyras(context.Background(), Request{Years: []int{2026}, Refresh: []int{2026}})
		done <- res
	}()
	select {
	case res := <-done:
		for _, file := range res.Files {
			if file.Year == 2026 && file.Source == SourceHyras && file.Outcome == Failed && !errors.Is(file.Err, pio.ErrStalled) {
				t.Errorf("%s fails with %v, want ErrStalled", file.Key, file.Err)
			}
		}
		if o := outcomes(res); o["pr_hyras_1_2026_v6-0_de.nc"] != Failed {
			t.Errorf("outcomes %v", o)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("the stalled download blocks the fetch")
	}
}

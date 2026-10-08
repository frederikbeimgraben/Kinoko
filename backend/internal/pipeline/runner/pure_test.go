package runner_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/sources"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/runner"
	"github.com/frederikbeimgraben/kinoko/backend/internal/pipeline/weather/dwd"
)

func TestScheduleParsesTheFormOfTheNixModule(t *testing.T) {
	s, err := runner.ParseSchedule("Mon 03:30 Europe/Berlin")
	if err != nil || s.Weekday != time.Monday || s.Hour != 3 || s.Minute != 30 || s.Zone.String() != "Europe/Berlin" {
		t.Fatalf("ParseSchedule = %+v, %v", s, err)
	}
	if s.String() != "Mon 03:30 Europe/Berlin" {
		t.Errorf("String = %q", s.String())
	}
	if u, err := runner.ParseSchedule("friday 22:05"); err != nil || u.Weekday != time.Friday || u.Zone != time.UTC {
		t.Errorf("ParseSchedule without zone = %+v, %v", u, err)
	}
	for _, bad := range []string{"", "Mon", "Mon 3h30 UTC", "Xyz 03:30 UTC", "Mon 03:30 Mars/Base", "Mon 25:00 UTC", "Mon 03:30 UTC extra"} {
		if _, err := runner.ParseSchedule(bad); err == nil {
			t.Errorf("ParseSchedule(%q) gives no error", bad)
		}
	}
}

func TestScheduleNextKeepsTheWallClockOfBerlin(t *testing.T) {
	s, _ := runner.ParseSchedule("Mon 03:30 Europe/Berlin")
	cases := []struct{ now, want string }{
		{"2026-10-08T12:00:00Z", "2026-10-12T01:30:00Z"}, // summer time: 03:30 CEST
		{"2026-10-12T01:30:00Z", "2026-10-19T01:30:00Z"}, // at the start time: the next week
		{"2026-10-12T01:29:59Z", "2026-10-12T01:30:00Z"},
		{"2026-10-20T00:00:00Z", "2026-10-26T02:30:00Z"}, // after the change on 25 October: 03:30 CET
		{"2026-12-28T05:00:00Z", "2027-01-04T02:30:00Z"}, // across the turn of the year
		{"2027-03-23T00:00:00Z", "2027-03-29T01:30:00Z"}, // after the change to summer time
	}
	for _, c := range cases {
		now, _ := time.Parse(time.RFC3339, c.now)
		want, _ := time.Parse(time.RFC3339, c.want)
		if got := s.Next(now); !got.Equal(want) {
			t.Errorf("Next(%s) = %s, want %s", c.now, got.UTC().Format(time.RFC3339), c.want)
		}
	}
}

func TestPlanNamesTheStagesOfEachKind(t *testing.T) {
	names := func(steps []runner.Step) []string {
		return fn.Map(steps, func(s runner.Step) string { return string(s) })
	}
	cases := map[enums.RunKind][]string{
		enums.RunKindFetch:    {"check inputs", "fetch weather", "fetch occurrences"},
		enums.RunKindTraining: {"check inputs", "weather checkpoints", "occurrences", "train models"},
		enums.RunKindRender:   {"check inputs", "weather checkpoints", "occurrences", "render maps", "render layers", "season table"},
		enums.RunKindFull: {"check inputs", "weather checkpoints", "occurrences", "train models",
			"render maps", "render layers", "season table"},
	}
	for kind, want := range cases {
		if got := names(runner.Plan(kind, nil)); !slices.Equal(got, want) {
			t.Errorf("Plan(%s) = %v", kind, got)
		}
	}
	soil := &sources.FetchRequest{Source: dwd.SourceSoil}
	if got := names(runner.Plan(enums.RunKindFetch, soil)); !slices.Equal(got, []string{"check inputs", "fetch weather"}) {
		t.Errorf("Plan(fetch soil) = %v", got)
	}
	if !runner.StepTrain.PerSpecies() || !runner.StepMaps.PerSpecies() || runner.StepLayers.PerSpecies() {
		t.Error("PerSpecies is wrong")
	}
}

func TestWeatherRequestBootstrapsAnEmptyCacheOnly(t *testing.T) {
	june := time.Date(2026, 6, 1, 3, 30, 0, 0, time.UTC)
	january := time.Date(2026, 1, 5, 3, 30, 0, 0, time.UTC)
	if r := runner.WeatherRequest(nil, true, june); !slices.Equal(r.Years, []int{2025, 2026}) || !slices.Equal(r.Refresh, []int{2026}) {
		t.Errorf("weekly June = %+v", r)
	}
	if r := runner.WeatherRequest(nil, true, january); !slices.Equal(r.Refresh, []int{2025, 2026}) {
		t.Errorf("weekly January = %+v", r)
	}
	if r := runner.WeatherRequest(nil, false, june); r.Years[0] != dwd.FirstYear || r.Years[len(r.Years)-1] != 2026 {
		t.Errorf("bootstrap = %+v", r)
	}
	from, to := 2020, 2021
	r := runner.WeatherRequest(&sources.FetchRequest{Source: dwd.SourceHyras, FromYear: &from, ToYear: &to}, true, june)
	if !slices.Equal(r.Years, []int{2020, 2021}) || len(r.Refresh) != 0 {
		t.Errorf("range = %+v", r)
	}
	r = runner.WeatherRequest(&sources.FetchRequest{Source: dwd.SourceHyras, Force: true}, true, june)
	if !slices.Equal(r.Refresh, r.Years) {
		t.Errorf("force = %+v", r)
	}
}

func TestOccurrencePlanRefreshesTheOpenYears(t *testing.T) {
	march := time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC)
	february := time.Date(2026, 2, 2, 0, 0, 0, 0, time.UTC)
	if p := runner.OccurrencePlan(nil, true, march); !slices.Equal(p.Years, []int{2026}) || !p.Refresh[2026] {
		t.Errorf("weekly March = %+v", p)
	}
	if p := runner.OccurrencePlan(nil, true, february); !slices.Equal(p.Years, []int{2025, 2026}) || !p.Refresh[2025] {
		t.Errorf("weekly February = %+v", p)
	}
	if p := runner.OccurrencePlan(nil, false, march); p.Years[0] != 2000 || p.Refresh[2010] || !p.Refresh[2026] {
		t.Errorf("bootstrap = %+v", p)
	}
	from := 2024
	p := runner.OccurrencePlan(&sources.FetchRequest{FromYear: &from, Force: true}, true, march)
	if !slices.Equal(p.Years, []int{2024, 2025, 2026}) || !p.Refresh[2024] {
		t.Errorf("forced range = %+v", p)
	}
}

func TestRefreshFromTakesTheOldestChangedYear(t *testing.T) {
	stamp := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2026, 10, 8, 0, 0, 0, 0, time.UTC)
	row := func(key string, fetched time.Time, state string) dwd.CacheRecord {
		return dwd.CacheRecord{Key: key, FetchedAt: fetched, State: state}
	}
	old := row("dwd/hyras/precipitation/pr_hyras_1_2024_v6-0_de.nc", stamp.Add(-time.Hour), dwd.StateOK)
	fresh := row("dwd/hyras/precipitation/pr_hyras_1_2026_v6-0_de.nc", stamp.Add(time.Hour), dwd.StateOK)
	soil := row("dwd/soil_moisture/oak/grids_germany_daily_soil_moisture_oak_2025_0-30_v1.nc", stamp.Add(time.Hour), dwd.StateOK)
	failed := row("dwd/hyras/humidity/hurs_hyras_5_2019_v6-0_de.nc", stamp.Add(time.Hour), dwd.StateFailed)
	if y, ok := runner.RefreshFrom([]dwd.CacheRecord{old, fresh, failed}, stamp, true, now); !ok || y != 2026 {
		t.Errorf("one change = %d, %v", y, ok)
	}
	if y, ok := runner.RefreshFrom([]dwd.CacheRecord{old, fresh, soil}, stamp, true, now); !ok || y != 2025 {
		t.Errorf("two changes = %d, %v", y, ok)
	}
	if _, ok := runner.RefreshFrom([]dwd.CacheRecord{old}, stamp, true, now); ok {
		t.Error("no change asks for an extraction")
	}
	if y, ok := runner.RefreshFrom([]dwd.CacheRecord{old}, time.Time{}, false, now); !ok || y != 2024 {
		t.Errorf("missing checkpoint = %d, %v", y, ok)
	}
	if y, ok := runner.RefreshFrom(nil, time.Time{}, false, now); !ok || y != 2026 {
		t.Errorf("missing checkpoint without rows = %d, %v", y, ok)
	}
}

func TestTheScheduleQueuesAFetchBeforeARenderOnce(t *testing.T) {
	f := newFixture(t, 1)
	plan, _ := runner.ParseSchedule("Mon 03:30 Europe/Berlin")
	ticks := make(chan time.Time)
	waits := make(chan time.Duration, 4)
	after := func(d time.Duration) <-chan time.Time {
		waits <- d
		return ticks
	}
	clock := time.Date(2026, 10, 12, 1, 0, 0, 0, time.UTC)
	f.runner = runner.New(runner.Config{DB: f.env.DB, Runs: f.runs, Sources: f.sources, Stages: f.stages,
		Logs: f.env.Settings.RunLogs, Now: func() time.Time { return clock }})
	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan struct{})
	go func() {
		f.runner.Scheduled(ctx, plan, after)
		close(stopped)
	}()
	if d := <-waits; d != 30*time.Minute {
		t.Errorf("first wait = %s", d)
	}
	ticks <- clock
	<-waits
	ticks <- clock
	<-waits
	cancel()
	<-stopped
	kinds, err := dbKinds(f)
	if err != nil || !slices.Equal(kinds, []string{"fetch", "render"}) {
		t.Fatalf("queued = %v, %v", kinds, err)
	}
	f.stages.fail = nil
	f.runNext()
	first := f.steps(mustClaimed(t, f))
	if len(first) == 0 || first[1].Name != "fetch weather" {
		t.Errorf("the render ran before the fetch: %+v", first)
	}
}

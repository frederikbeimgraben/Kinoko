package runner

import (
	"fmt"
	"strings"
	"time"
	_ "time/tzdata" // The host can lack the zone files; Europe/Berlin must load.
)

// Schedule is one weekly start time in a time zone.
type Schedule struct {
	Weekday      time.Weekday
	Hour, Minute int
	Zone         *time.Location
}

var weekdays = map[string]time.Weekday{
	"sun": time.Sunday, "mon": time.Monday, "tue": time.Tuesday, "wed": time.Wednesday,
	"thu": time.Thursday, "fri": time.Friday, "sat": time.Saturday,
}

// ParseSchedule reads "<Weekday> HH:MM <IANA zone>", for example "Mon 03:30 Europe/Berlin".
// The weekday takes its first three letters, without case. Without a zone the time is UTC.
func ParseSchedule(text string) (Schedule, error) {
	fields := strings.Fields(text)
	if len(fields) < 2 || len(fields) > 3 {
		return Schedule{}, fmt.Errorf("runner: schedule %q: use \"<Weekday> HH:MM <zone>\"", text)
	}
	name := strings.ToLower(fields[0])
	day, ok := weekdays[name[:min(3, len(name))]]
	if !ok {
		return Schedule{}, fmt.Errorf("runner: schedule %q: unknown weekday %q", text, fields[0])
	}
	clock, err := time.Parse("15:04", fields[1])
	if err != nil {
		return Schedule{}, fmt.Errorf("runner: schedule %q: time %q is not HH:MM", text, fields[1])
	}
	zone := time.UTC
	if len(fields) == 3 {
		if zone, err = time.LoadLocation(fields[2]); err != nil {
			return Schedule{}, fmt.Errorf("runner: schedule %q: %w", text, err)
		}
	}
	return Schedule{Weekday: day, Hour: clock.Hour(), Minute: clock.Minute(), Zone: zone}, nil
}

// Next gives the first start time strictly after the given time. The wall clock of the
// zone counts, so the start stays at 03:30 across a change of summer time.
func (s Schedule) Next(now time.Time) time.Time {
	local := now.In(s.Zone)
	for days := 0; days <= 7; days++ {
		d := local.AddDate(0, 0, days)
		at := time.Date(d.Year(), d.Month(), d.Day(), s.Hour, s.Minute, 0, 0, s.Zone)
		if at.Weekday() == s.Weekday && at.After(now) {
			return at
		}
	}
	return local.AddDate(0, 0, 7)
}

// String gives the schedule in the form that ParseSchedule reads.
func (s Schedule) String() string {
	return fmt.Sprintf("%s %02d:%02d %s", s.Weekday.String()[:3], s.Hour, s.Minute, s.Zone)
}

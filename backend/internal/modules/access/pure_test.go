package access

import (
	"slices"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

func TestNewCodeUsesTheAlphabet(t *testing.T) {
	if got := newCode(func(int) int { return 0 }); got != "PILZ-AAAA" {
		t.Fatal(got)
	}
	if got := newCode(func(n int) int { return n - 1 }); got != "PILZ-9999" {
		t.Fatal(got)
	}
	if got := fallbackCode(db.MustID("abcdef01-0000-0000-0000-000000000000")); got != "PILZ-ABCDEF01" {
		t.Fatal(got)
	}
}

func TestPlanPermissionsUpsertsAndDrops(t *testing.T) {
	plan := planPermissions(map[string]string{"species.edit": "data", "text.edit": "interface", "old": "data"})
	if !slices.Equal(plan.drop, []string{"old"}) {
		t.Fatal(plan.drop)
	}
	if len(plan.upsert) != len(Permissions)-1 || plan.upsert[0].Key != "species.edit" {
		t.Fatal(plan.upsert)
	}
}

func TestLastAdminConflict(t *testing.T) {
	admin := db.NewID()
	only := adminState{exists: true, id: admin, held: true, people: 1}
	cases := []struct {
		state adminState
		next  []db.ID
		want  bool
	}{
		{only, nil, true},
		{only, []db.ID{}, true},
		{only, []db.ID{admin}, false},
		{adminState{exists: true, id: admin, held: true, people: 2}, nil, false},
		{adminState{exists: true, id: admin, held: false, people: 1}, nil, false},
		{adminState{}, nil, false},
	}
	for i, c := range cases {
		if got := lastAdminConflict(c.state, c.next); got != c.want {
			t.Errorf("case %d: %v", i, got)
		}
	}
}

func TestParseNameIDs(t *testing.T) {
	id := db.NewID()
	got, err := parseNameIDs(" " + id.String() + " ,, " + id.String())
	if err != nil || len(got) != 2 || got[0] != id {
		t.Fatal(got, err)
	}
	for _, bad := range []string{"", " , ", "x"} {
		if _, err := parseNameIDs(bad); err == nil {
			t.Fatal(bad)
		}
	}
}

func TestSummaryKeepsTheOrder(t *testing.T) {
	out, err := summary{{"photos", 2}, {"photosPending", 1}}.MarshalJSON()
	if err != nil || string(out) != `{"photos":2,"photosPending":1}` {
		t.Fatal(string(out), err)
	}
}

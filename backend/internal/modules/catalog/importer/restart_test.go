package importer

import (
	"context"
	"testing"
)

// A restart must keep the changes of the admins. A sync on each start added a deleted reagent term again.
func TestRestartKeepsAdminChanges(t *testing.T) {
	handle := openDB(t)
	ctx := context.Background()
	data := realData(t)
	if err := SeedIfEmpty(ctx, handle, data, fixedNow); err != nil {
		t.Fatal(err)
	}
	for _, change := range []string{
		"DELETE FROM term WHERE kind = 'trigger' AND slug = 'meixner'",
		`UPDATE species_reaction SET reading = 'geprüft' WHERE position = 0 AND species_id =
			(SELECT id FROM species WHERE slug = 'boletus-edulis')`,
		"UPDATE species SET edibility_note = 'geprüft' WHERE slug = 'boletus-edulis'",
	} {
		if _, err := handle.ExecContext(ctx, change); err != nil {
			t.Fatal(err)
		}
	}
	if err := SeedIfEmpty(ctx, handle, data, fixedNow); err != nil {
		t.Fatal(err)
	}
	if n := count(t, handle, "SELECT count(*) FROM term WHERE slug = 'meixner'"); n != 0 {
		t.Fatal("the restart added the deleted reagent term again")
	}
	if n := count(t, handle, "SELECT count(*) FROM species_reaction WHERE reading = 'geprüft'"); n != 1 {
		t.Fatal("the restart replaced the changed reaction")
	}
	if n := count(t, handle, "SELECT count(*) FROM species WHERE edibility_note = 'geprüft'"); n != 1 {
		t.Fatal("the restart replaced the changed species")
	}
}

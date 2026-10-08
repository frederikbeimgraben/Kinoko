// Package shared holds the queries that more than one module reads.
package shared

import (
	"context"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// MemberGroupIDs gives the keys of the groups that the person is a member of.
func MemberGroupIDs(ctx context.Context, q db.Querier, user db.ID) (map[db.ID]struct{}, error) {
	ids, err := db.Column[db.ID](ctx, q, "SELECT group_id FROM group_member WHERE user_id = ?", user)
	return fn.Set(ids), err
}

type lead struct {
	species db.ID
	photo   db.ID
}

// PhotoLeads gives the title photo of each species: the chosen photo, else
// the oldest approved photo.
func PhotoLeads(ctx context.Context, q db.Querier, species []db.ID) (map[db.ID]db.ID, error) {
	if len(species) == 0 {
		return map[db.ID]db.ID{}, nil
	}
	rows, err := db.All(ctx, q, func(s db.Scanner) (lead, error) {
		var l lead
		return l, s.Scan(&l.species, &l.photo)
	}, `SELECT species_id, id FROM photo
		WHERE species_id IN (`+db.Placeholders(len(species))+`) AND state = 'approved'
		ORDER BY species_id, lead DESC, created_at ASC`, db.Args(species)...)
	if err != nil {
		return nil, err
	}
	return fn.Reduce(rows, map[db.ID]db.ID{}, func(acc map[db.ID]db.ID, l lead) map[db.ID]db.ID {
		if _, seen := acc[l.species]; !seen {
			acc[l.species] = l.photo
		}
		return acc
	}), nil
}

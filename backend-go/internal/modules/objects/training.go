package objects

import (
	"context"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
)

// TrainingFind is a find that the pipeline uses to train the model.
type TrainingFind struct {
	ID        db.ID   `json:"id"`
	SpeciesID db.ID   `json:"speciesId"`
	Lat       float64 `json:"lat"`
	Lon       float64 `json:"lon"`
	FoundOn   db.Date `json:"foundOn"`
	Count     *int    `json:"count"`
}

// TrainingFinds gives the finds released for training: accepted, marked
// for training, not deleted, and of a species with a forecast.
func TrainingFinds(ctx context.Context, q db.Querier) ([]TrainingFind, error) {
	return db.All(ctx, q, func(s db.Scanner) (TrainingFind, error) {
		var f TrainingFind
		return f, s.Scan(&f.ID, &f.SpeciesID, &f.Lat, &f.Lon, &f.FoundOn, &f.Count)
	}, `SELECT find.id, find.species_id, find.lat, find.lon, find.found_on, find.count
		FROM find JOIN species ON species.id = find.species_id
		WHERE find.for_training = 1 AND find.review_state = ? AND find.deleted_at IS NULL
			AND species.forecast_enabled = 1`, enums.ReviewStateAccepted)
}

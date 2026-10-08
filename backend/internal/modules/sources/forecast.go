package sources

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

// defaultMinForest is the forest share below which the map shows no value.
const defaultMinForest = 0.03

// Chain is the forecast chain of one species: the internal name of the
// series, the scientific names whose records count, and the forest mask.
type Chain struct {
	Key       string
	Taxa      []string
	MinForest float64
}

// Chains is the list of run_all.sh. The first taxon that the catalogue
// knows names the species, as species_slug.matching_slug does.
var Chains = []Chain{
	{"boletus_edulis", []string{"Boletus edulis"}, defaultMinForest},
	{"pfifferling", []string{"Cantharellus cibarius"}, defaultMinForest},
	{"birkenpilz", []string{"Leccinum scabrum"}, defaultMinForest},
	{"reizker", []string{"Lactarius deliciosus", "Lactarius deterrimus", "Lactarius salmonicolor", "Lactarius semisanguifluus"}, defaultMinForest},
	{"hexen_flock", []string{"Neoboletus erythropus"}, defaultMinForest},
	{"hexen_netz", []string{"Suillellus luridus"}, defaultMinForest},
	{"parasol", []string{"Macrolepiota procera"}, defaultMinForest},
	{"nebelkappe", []string{"Clitocybe nebularis"}, defaultMinForest},
	{"flaschenbovist", []string{"Lycoperdon perlatum"}, defaultMinForest},
	{"schleimruebling", []string{"Mucidula mucida"}, defaultMinForest},
	// The shaggy ink cap grows at path edges and in meadows. A forest mask would hide it.
	{"schopftintling", []string{"Coprinus comatus"}, 0.0},
}

// ForecastRow is one row of species_forecast.
type ForecastRow struct {
	SpeciesID db.ID
	Chain     Chain
}

// matchChains gives the species of each chain. A chain without a catalogue
// match has no row. Latin names compare without case.
func matchChains(chains []Chain, byLatin map[string]db.ID) []ForecastRow {
	return fn.FlatMap(chains, func(c Chain) []ForecastRow {
		hit, ok := fn.Find(c.Taxa, func(name string) bool {
			_, known := byLatin[strings.ToLower(strings.TrimSpace(name))]
			return known
		})
		if !ok {
			return nil
		}
		return []ForecastRow{{SpeciesID: byLatin[strings.ToLower(strings.TrimSpace(hit))], Chain: c}}
	})
}

// seedForecasts adds the chain of each matched species. It keeps rows that exist.
func seedForecasts(ctx context.Context, handle *sql.DB) error {
	type species struct {
		id    db.ID
		latin string
	}
	all, err := db.All(ctx, handle, func(s db.Scanner) (species, error) {
		var sp species
		return sp, s.Scan(&sp.id, &sp.latin)
	}, "SELECT id, latin_name FROM species")
	if err != nil {
		return err
	}
	byLatin := fn.Reduce(all, map[string]db.ID{}, func(acc map[string]db.ID, sp species) map[string]db.ID {
		acc[strings.ToLower(sp.latin)] = sp.id
		return acc
	})
	return db.InTx(ctx, handle, func(tx *sql.Tx) error {
		for _, row := range matchChains(Chains, byLatin) {
			taxa, err := json.Marshal(row.Chain.Taxa)
			if err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO species_forecast
				(species_id, chain_key, taxa, min_forest) VALUES (?, ?, ?, ?)`,
				row.SpeciesID, row.Chain.Key, string(taxa), row.Chain.MinForest); err != nil {
				return err
			}
		}
		return nil
	})
}

// Forecasts gives the chain of each species with forecast, by chain key.
func (m *Module) Forecasts(ctx context.Context) ([]ForecastRow, error) {
	return db.All(ctx, m.deps.DB, func(s db.Scanner) (ForecastRow, error) {
		var row ForecastRow
		var taxa string
		if err := s.Scan(&row.SpeciesID, &row.Chain.Key, &taxa, &row.Chain.MinForest); err != nil {
			return row, err
		}
		return row, json.Unmarshal([]byte(taxa), &row.Chain.Taxa)
	}, `SELECT f.species_id, f.chain_key, f.taxa, f.min_forest FROM species_forecast f
		JOIN species s ON s.id = f.species_id WHERE s.forecast_enabled = 1 ORDER BY f.chain_key`)
}

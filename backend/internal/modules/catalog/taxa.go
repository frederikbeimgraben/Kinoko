package catalog

import (
	"context"
	"net/http"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
	"github.com/frederikbeimgraben/kinoko/backend/internal/shared"
)

// TaxonStep is a short node of the taxonomy.
type TaxonStep struct {
	ID   db.ID           `json:"id"`
	Slug string          `json:"slug"`
	Name string          `json:"name"`
	Rank enums.TaxonRank `json:"rank"`
}

// TaxonChild is a child taxon with the count of species below it.
type TaxonChild struct {
	TaxonStep
	SpeciesCount int `json:"speciesCount"`
}

// TaxonPage is the page of a taxon: path, siblings, children and species.
type TaxonPage struct {
	TaxonStep
	Description  *string      `json:"description"`
	Path         []TaxonStep  `json:"path"`
	Siblings     []TaxonStep  `json:"siblings"`
	Children     []TaxonChild `json:"children"`
	Species      []Summary    `json:"species"`
	SpeciesCount int          `json:"speciesCount"`
}

func stepOf(t taxonRow) TaxonStep { return TaxonStep{t.ID, t.Slug, t.Name, t.Rank} }

// subtree gives the taxon and each descendant, level by level.
func subtree(rows []taxonRow, root db.ID) []db.ID {
	found := []db.ID{root}
	seen := map[db.ID]bool{root: true}
	frontier := []db.ID{root}
	for len(frontier) > 0 {
		next := []db.ID{}
		for _, t := range rows {
			if t.ParentID != nil && !seen[t.ID] && fn.Any(frontier, func(id db.ID) bool { return id == *t.ParentID }) {
				seen[t.ID] = true
				next = append(next, t.ID)
			}
		}
		found = append(found, next...)
		frontier = next
	}
	return found
}

func allTaxa(ctx context.Context, q db.Querier) ([]taxonRow, error) {
	return db.All(ctx, q, scanTaxon, "SELECT "+taxonCols+" FROM taxon")
}

func subtreeIDs(ctx context.Context, q db.Querier, root db.ID) ([]db.ID, error) {
	rows, err := allTaxa(ctx, q)
	return subtree(rows, root), err
}

func (m *Module) taxonPage(r *http.Request) (web.Response, error) {
	ctx := r.Context()
	q := m.deps.DB
	taxon, err := db.One(ctx, q, scanTaxon, "SELECT "+taxonCols+" FROM taxon WHERE rank = ? AND slug = ?",
		r.PathValue("rank"), r.PathValue("slug"))
	if err != nil {
		return nil, err
	}
	rows, err := allTaxa(ctx, q)
	if err != nil {
		return nil, err
	}
	byID := fn.KeyBy(rows, func(t taxonRow) db.ID { return t.ID })
	path := []TaxonStep{}
	for current, seen := taxon, map[db.ID]bool{taxon.ID: true}; current.ParentID != nil; {
		parent, ok := byID[*current.ParentID]
		if !ok || seen[parent.ID] {
			break
		}
		seen[parent.ID] = true
		path = append([]TaxonStep{stepOf(parent)}, path...)
		current = parent
	}
	sameParent := func(t taxonRow) bool {
		if taxon.ParentID == nil {
			return t.ParentID == nil
		}
		return t.ParentID != nil && *t.ParentID == *taxon.ParentID
	}
	siblings := fn.Map(fn.Filter(rows, func(t taxonRow) bool { return sameParent(t) && t.ID != taxon.ID }), stepOf)
	kids, err := fn.MapErr(fn.Filter(rows, func(t taxonRow) bool {
		return t.ParentID != nil && *t.ParentID == taxon.ID
	}), func(t taxonRow) (TaxonChild, error) {
		where, args := scope("taxon_id", subtree(rows, t.ID))
		count, err := db.Scalar[int](ctx, q, "SELECT count(*) FROM species WHERE "+where, args...)
		return TaxonChild{stepOf(t), count}, err
	})
	if err != nil {
		return nil, err
	}
	where, args := scope("taxon_id", subtree(rows, taxon.ID))
	species, err := db.All(ctx, q, scanSpecies, "SELECT "+speciesCols+" FROM species WHERE "+where+" ORDER BY name", args...)
	if err != nil {
		return nil, err
	}
	leads, err := shared.PhotoLeads(ctx, q, speciesIDs(species))
	if err != nil {
		return nil, err
	}
	names, err := loadTaxonNames(ctx, q)
	if err != nil {
		return nil, err
	}
	return web.OK(TaxonPage{
		TaxonStep:   stepOf(taxon),
		Description: taxon.Description,
		Path:        path,
		Siblings:    siblings,
		Children:    kids,
		Species: fn.Map(species, func(s speciesRow) Summary {
			return summaryOf(s, leadOf(children{leads: leads}, s.ID), names)
		}),
		SpeciesCount: len(species),
	}), nil
}

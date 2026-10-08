package objects

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/problem"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/web"
	"github.com/frederikbeimgraben/kinoko/backend/internal/fn"
)

type combinationRow struct {
	owned
	Name    string
	Rule    enums.Rule
	Factors string
}

var combinations = kind[combinationRow]{
	table:   "combination",
	columns: "id, owner_id, name, rule, factors, created_at, updated_at, deleted_at",
	scan: func(s db.Scanner) (combinationRow, error) {
		var c combinationRow
		err := s.Scan(&c.ID, &c.OwnerID, &c.Name, &c.Rule, &c.Factors, &c.CreatedAt, &c.UpdatedAt, &c.DeletedAt)
		return c, err
	},
	meta: func(c combinationRow) owned { return c.owned },
}

// factor is one factor of a combination, in the order of the old schema.
type factor struct {
	Source    string          `json:"source"`
	Condition enums.Condition `json:"condition"`
	Low       *float64        `json:"low"`
	High      *float64        `json:"high"`
	Active    bool            `json:"active"`
}

type factorIn struct {
	Source    string          `json:"source"`
	Condition enums.Condition `json:"condition"`
	Low       *laxFloat       `json:"low"`
	High      *laxFloat       `json:"high"`
	Active    *bool           `json:"active"`
}

func (f factorIn) factor() factor {
	return factor{
		Source: f.Source, Condition: f.Condition,
		Low: optFloat(f.Low), High: optFloat(f.High), Active: fn.Deref(f.Active, true),
	}
}

func optFloat(f *laxFloat) *float64 {
	if f == nil {
		return nil
	}
	return fn.Ptr(float64(*f))
}

// storedFactors writes the factors as Python json.dumps does, with its
// default separators and with ensure_ascii.
func storedFactors(factors []factor) string {
	return "[" + strings.Join(fn.Map(factors, func(f factor) string {
		return "{" + strings.Join([]string{
			`"source": ` + pyString(f.Source),
			`"condition": ` + pyString(string(f.Condition)),
			`"low": ` + pyOptFloat(f.Low),
			`"high": ` + pyOptFloat(f.High),
			`"active": ` + pyBool(f.Active),
		}, ", ") + "}"
	}), ", ") + "]"
}

func readFactors(text string) []factor {
	var stored []factorIn
	if err := json.Unmarshal([]byte(text), &stored); err != nil {
		return []factor{}
	}
	return fn.Map(stored, factorIn.factor)
}

type combinationOut struct {
	ID        db.ID      `json:"id"`
	OwnerID   db.ID      `json:"ownerId"`
	Name      string     `json:"name"`
	Rule      enums.Rule `json:"rule"`
	Factors   []factor   `json:"factors"`
	CreatedAt db.Time    `json:"createdAt"`
	UpdatedAt db.Time    `json:"updatedAt"`
	Deleted   bool       `json:"deleted"`
}

func combinationOf(c combinationRow) combinationOut {
	return combinationOut{
		ID: c.ID, OwnerID: c.OwnerID, Name: c.Name, Rule: c.Rule, Factors: readFactors(c.Factors),
		CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt, Deleted: c.DeletedAt != nil,
	}
}

type combinationWrite struct {
	Name    string     `json:"name"`
	Rule    enums.Rule `json:"rule"`
	Factors []factorIn `json:"factors"`
}

func (m *Module) combinationValues(r *http.Request) func(db.ID) ([]column, error) {
	return func(db.ID) ([]column, error) {
		body, err := web.Decode[combinationWrite](r)
		if err != nil {
			return nil, err
		}
		factors := fn.Map(body.Factors, factorIn.factor)
		if errs := checkSources(m.deps.Settings.Maps, fn.Map(factors, func(f factor) string { return f.Source })); len(errs) > 0 {
			return nil, problem.Invalid(errs...)
		}
		return []column{{"name", body.Name}, {"rule", body.Rule}, {"factors", storedFactors(factors)}}, nil
	}
}

func (m *Module) listCombinations(r *http.Request) (web.Response, error) {
	return ownList(m, r, combinations, combinationOf)
}

func (m *Module) createCombination(r *http.Request) (web.Response, error) {
	return ownWrite(m, r, combinations, false, m.combinationValues(r), combinationOf)
}

func (m *Module) getCombination(r *http.Request) (web.Response, error) {
	return ownGet(m, r, combinations, combinationOf)
}

func (m *Module) putCombination(r *http.Request) (web.Response, error) {
	return ownWrite(m, r, combinations, true, m.combinationValues(r), combinationOf)
}

func (m *Module) deleteCombination(r *http.Request) (web.Response, error) {
	return ownDelete(m, r, combinations)
}

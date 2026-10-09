package photos_test

import (
	"net/http"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

func TestReopenTakesBackAnApproval(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	photo := approvedPhoto(t, env, owner, species)
	body := env.Delete("/photos/"+idOf(photo)+"/review", owner).Expect(t, http.StatusOK).Map(t)
	if body["state"] != "submitted" || body["lead"] != false || body["reviewedById"] != nil || body["reviewedAt"] != nil {
		t.Fatal(body)
	}
	if leadOf(t, env, species) != "" {
		t.Fatal("reopened photo is still the lead")
	}
}

func TestReopenTakesBackARejection(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	photo := created(t, env, owner, map[string]string{"speciesId": species.String()})
	env.Post("/photos/"+idOf(photo)+"/rejection", map[string]any{"reason": "unscharf"}, owner).Expect(t, http.StatusOK)
	body := env.Delete("/photos/"+idOf(photo)+"/review", owner).Expect(t, http.StatusOK).Map(t)
	if body["state"] != "submitted" || body["rejectReason"] != nil {
		t.Fatal(body)
	}
}

func TestReopenKeepsTheLeadOfAnotherPhoto(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	first := approvedPhoto(t, env, owner, species)
	second := approvedPhoto(t, env, owner, species)
	env.Delete("/photos/"+idOf(second)+"/review", owner).Expect(t, http.StatusOK)
	if leadOf(t, env, species) != idOf(first) {
		t.Fatal("lead changed")
	}
}

func TestReopenOfASubmittedPhotoIsAConflict(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	photo := created(t, env, owner, map[string]string{"speciesId": species.String()})
	env.Delete("/photos/"+idOf(photo)+"/review", owner).Expect(t, http.StatusConflict)
}

func TestReopenUnknownPhotoIsNotFound(t *testing.T) {
	env := newEnv(t)
	reviewer := signIn(t, env, makeUser(t, env, "reviewer"), review)
	env.Delete("/photos/"+db.NewID().String()+"/review", reviewer).Expect(t, http.StatusNotFound)
}

func TestReopenWithoutRightIsForbidden(t *testing.T) {
	env := newEnv(t)
	owner, _, photo := setupSpeciesPhoto(t, env)
	env.Delete("/photos/"+idOf(photo)+"/review", owner).Expect(t, http.StatusForbidden)
}

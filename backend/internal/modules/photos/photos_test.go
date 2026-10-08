package photos_test

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/auth"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/config"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
	"github.com/frederikbeimgraben/kinoko/backend/internal/core/enums"
	"github.com/frederikbeimgraben/kinoko/backend/internal/modules/photos"
	"github.com/frederikbeimgraben/kinoko/backend/internal/shared"
	"github.com/frederikbeimgraben/kinoko/backend/internal/testkit"
)

const (
	submit = "image.submit"
	review = "image.review"
)

func none() map[string]string { return nil }

func TestCreatePrivatePhotoWithoutContext(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	body := created(t, env, user, none())
	if body["state"] != "private" || body["speciesId"] != nil || body["findId"] != nil || body["lat"] != nil {
		t.Fatal(body)
	}
	if body["width"] != 40.0 || body["height"] != 40.0 || body["lead"] != false {
		t.Fatal(body)
	}
}

func TestCreateKeepsSourceAndNamesTheUploader(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	body := created(t, env, user, map[string]string{"source": "123pilzsuche.de"})
	if body["source"] != "123pilzsuche.de" || body["ownerName"] != user.Name {
		t.Fatal(body)
	}
}

func TestPhotoWithoutOwnerNameFallsBackToPhotographer(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	user.Name = ""
	body := created(t, env, user, none())
	if body["ownerName"] != "Frederik" {
		t.Fatal(body)
	}
}

func TestCreateRequiresSignedInAccount(t *testing.T) {
	env := newEnv(t)
	upload(t, env, nil, none()).Expect(t, http.StatusUnauthorized)
}

func TestCreateRequiresImageSubmitRight(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"))
	upload(t, env, user, none()).Expect(t, http.StatusForbidden)
}

func TestCreateRequiresPhotographerAndLicence(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	response := postForm(t, env, user, map[string]string{}, imageBytes(t, 40, 40), jpegType)
	response.Expect(t, http.StatusUnprocessableEntity)
	expectErrors(t, response, "photographer", "missing", "licence", "missing")
}

func TestCreateFieldCodes(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	long := string(make([]rune, 201))
	response := postForm(t, env, user, map[string]string{
		"photographer": "Frederik", "licence": "stolen", "speciesId": "x",
		"caption": long, "takenOn": "gestern",
	}, nil, "")
	response.Expect(t, http.StatusUnprocessableEntity)
	expectErrors(t, response, "file", "missing", "licence", "enum", "speciesId", "uuid_parsing",
		"caption", "string_too_long", "takenOn", "date_from_datetime_parsing")
}

func TestCreateRejectsWrongMediaType(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	response := postForm(t, env, user, form(nil), []byte("not-an-image"), "text/plain")
	response.Expect(t, http.StatusUnprocessableEntity)
	expectErrors(t, response, "file", "media_type")
}

func TestCreateRejectsBrokenImage(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	response := postForm(t, env, user, form(nil), []byte("kein Bild"), jpegType)
	response.Expect(t, http.StatusUnprocessableEntity)
	expectErrors(t, response, "file", "image")
}

func TestCreateRejectsTooLargeBody(t *testing.T) {
	env := newEnv(t, testkit.WithSettings(func(s *config.Settings) { s.MaxPhotoBytes = 10 }))
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	response := upload(t, env, user, none()).Expect(t, http.StatusRequestEntityTooLarge)
	if response.Map(t)["code"] != "too_large" {
		t.Fatal(string(response.Body))
	}
}

func TestCreateAcceptsCaptionAndTakenOn(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	body := created(t, env, user, map[string]string{"caption": "Fund im Wald", "takenOn": "2026-09-01"})
	if body["caption"] != "Fund im Wald" || body["takenOn"] != "2026-09-01" {
		t.Fatal(body)
	}
}

func TestCreateAttachToOwnFindRoundsProtectedLocation(t *testing.T) {
	env := newEnv(t)
	person := makeUser(t, env, "u")
	species := makeSpecies(t, env, "boletus-edulis", enums.ProtectionStrict)
	find := makeFind(t, env, person, &species, 52.523, 13.411)
	user := signIn(t, env, person, submit)
	body := created(t, env, user, map[string]string{"findId": find.String()})
	if body["state"] != "private" || body["findId"] != find.String() || body["speciesId"] != nil {
		t.Fatal(body)
	}
	lat, lon := body["lat"].(float64), body["lon"].(float64)
	if lat == 52.523 || lon == 13.411 {
		t.Fatal(body)
	}
	// Values of the Python service for coarse((13.411, 52.523)).
	if lat != 52.52425440172476 || lon != 13.40618535749036 {
		t.Fatalf("lat %v lon %v", lat, lon)
	}
}

func TestCreateAttachToUnprotectedSpeciesHasNoLocation(t *testing.T) {
	env := newEnv(t)
	person := makeUser(t, env, "u")
	species := makeSpecies(t, env, "agaricus-bisporus", enums.ProtectionNone)
	find := makeFind(t, env, person, &species, 52.523, 13.411)
	body := created(t, env, signIn(t, env, person, submit), map[string]string{"findId": find.String()})
	if body["lat"] != nil || body["lon"] != nil {
		t.Fatal(body)
	}
}

func TestCreateAttachToFindWithoutSpeciesHasNoLocation(t *testing.T) {
	env := newEnv(t)
	person := makeUser(t, env, "u")
	find := makeFind(t, env, person, nil, 52.523, 13.411)
	body := created(t, env, signIn(t, env, person, submit), map[string]string{"findId": find.String()})
	if body["lat"] != nil || body["lon"] != nil {
		t.Fatal(body)
	}
}

func TestCreateAttachToForeignFindIsNotFound(t *testing.T) {
	env := newEnv(t)
	owner := makeUser(t, env, "owner")
	other := signIn(t, env, makeUser(t, env, "other"), submit)
	find := makeFind(t, env, owner, nil, 52.523, 13.411)
	upload(t, env, other, map[string]string{"findId": find.String()}).Expect(t, http.StatusNotFound)
}

func TestCreateAttachToForeignFindIsCheckedBeforeTheImage(t *testing.T) {
	env := newEnv(t)
	owner := makeUser(t, env, "owner")
	other := signIn(t, env, makeUser(t, env, "other"), submit)
	find := makeFind(t, env, owner, nil, 52.523, 13.411)
	postForm(t, env, other, form(map[string]string{"findId": find.String()}), []byte("x"), "text/plain").
		Expect(t, http.StatusNotFound)
}

func TestCreateSubmitToSpecies(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	species := makeSpecies(t, env, "boletus-edulis", enums.ProtectionNone)
	body := created(t, env, user, map[string]string{"speciesId": species.String()})
	if body["state"] != "submitted" || body["speciesId"] != species.String() || body["lat"] != nil {
		t.Fatal(body)
	}
}

func TestCreateSubmitToUnknownSpeciesIsNotFound(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	upload(t, env, user, map[string]string{"speciesId": db.NewID().String()}).Expect(t, http.StatusNotFound)
}

func TestCreateWritesThreeJPEGSizes(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	response := postForm(t, env, user, form(nil), imageBytes(t, 2000, 1500), jpegType)
	body := response.Expect(t, http.StatusCreated).Map(t)
	if body["width"] != 2000.0 || body["height"] != 1500.0 {
		t.Fatal(body)
	}
	folder := filepath.Join(env.Settings.Photos, idOf(body))
	for size, want := range map[string][2]int{"thumb": {88, 66}, "list": {320, 240}, "full": {1600, 1200}} {
		width, height := jpegSize(t, filepath.Join(folder, size+".jpg"))
		if width != want[0] || height != want[1] {
			t.Errorf("%s: %dx%d", size, width, height)
		}
	}
}

func setupSpeciesPhoto(t *testing.T, env *testkit.Env) (*testkit.Person, db.ID, map[string]any) {
	t.Helper()
	owner := signIn(t, env, makeUser(t, env, "owner"), submit)
	species := makeSpecies(t, env, "boletus-edulis", enums.ProtectionNone)
	return owner, species, created(t, env, owner, map[string]string{"speciesId": species.String()})
}

func TestApprovalSetsStateAndReviewer(t *testing.T) {
	env := newEnv(t)
	_, _, photo := setupSpeciesPhoto(t, env)
	reviewerPerson := makeUser(t, env, "reviewer")
	reviewer := signIn(t, env, reviewerPerson, review)
	body := env.Post("/photos/"+idOf(photo)+"/approval", nil, reviewer).Expect(t, http.StatusOK).Map(t)
	if body["state"] != "approved" || body["reviewedById"] != userID(t, env, reviewerPerson).String() || body["reviewedAt"] == nil {
		t.Fatal(body)
	}
}

func TestApprovalWithoutRightIsForbidden(t *testing.T) {
	env := newEnv(t)
	owner, _, photo := setupSpeciesPhoto(t, env)
	env.Post("/photos/"+idOf(photo)+"/approval", nil, owner).Expect(t, http.StatusForbidden)
}

func TestApprovalUnknownPhotoIsNotFound(t *testing.T) {
	env := newEnv(t)
	reviewer := signIn(t, env, makeUser(t, env, "reviewer"), review)
	env.Post("/photos/"+db.NewID().String()+"/approval", nil, reviewer).Expect(t, http.StatusNotFound)
}

func TestRejectionRequiresReason(t *testing.T) {
	env := newEnv(t)
	_, _, photo := setupSpeciesPhoto(t, env)
	reviewer := signIn(t, env, makeUser(t, env, "reviewer"), review)
	env.Post("/photos/"+idOf(photo)+"/rejection", map[string]any{"reason": ""}, reviewer).
		Expect(t, http.StatusUnprocessableEntity)
}

func TestRejectionAndResubmissionReusesSamePhoto(t *testing.T) {
	env := newEnv(t)
	owner, species, photo := setupSpeciesPhoto(t, env)
	reviewer := signIn(t, env, makeUser(t, env, "reviewer"), review)
	rejected := env.Post("/photos/"+idOf(photo)+"/rejection", map[string]any{"reason": "unscharf"}, reviewer).
		Expect(t, http.StatusOK).Map(t)
	if rejected["state"] != "rejected" || rejected["rejectReason"] != "unscharf" {
		t.Fatal(rejected)
	}
	again := created(t, env, owner, map[string]string{"speciesId": species.String(), "source": "neu"})
	if idOf(again) != idOf(photo) || again["state"] != "submitted" || again["rejectReason"] != nil ||
		again["reviewedById"] != nil || again["reviewedAt"] != nil || again["source"] != nil {
		t.Fatal(again)
	}
}

func TestResubmitServiceResetsState(t *testing.T) {
	owner := db.NewID()
	species := db.NewID()
	photo := photos.Photo{OwnerID: &owner, SpeciesID: &species, State: enums.PhotoStateRejected}
	if err := photos.Resubmittable(photo, owner); err != nil {
		t.Fatal(err)
	}
}

func TestResubmitRejectsWrongState(t *testing.T) {
	owner := db.NewID()
	photo := photos.Photo{OwnerID: &owner, State: enums.PhotoStatePrivate}
	if err := photos.Resubmittable(photo, owner); err == nil {
		t.Fatal("expected a conflict")
	}
	rejected := photos.Photo{OwnerID: &owner, State: enums.PhotoStateRejected}
	if err := photos.Resubmittable(rejected, db.NewID()); err == nil {
		t.Fatal("expected a conflict for another person")
	}
}

func reviewerOwner(t *testing.T, env *testkit.Env) (*testkit.Person, db.ID) {
	t.Helper()
	owner := signIn(t, env, makeUser(t, env, "owner"), review, submit)
	return owner, makeSpecies(t, env, "boletus-edulis", enums.ProtectionNone)
}

func approvedPhoto(t *testing.T, env *testkit.Env, as *testkit.Person, species db.ID) map[string]any {
	t.Helper()
	photo := created(t, env, as, map[string]string{"speciesId": species.String()})
	return env.Post("/photos/"+idOf(photo)+"/approval", nil, as).Expect(t, http.StatusOK).Map(t)
}

func TestSetLeadReplacesPrevious(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	first := approvedPhoto(t, env, owner, species)
	second := approvedPhoto(t, env, owner, species)
	lead1 := env.Put("/photos/"+idOf(first)+"/lead", nil, owner).Expect(t, http.StatusOK).Map(t)
	if lead1["lead"] != true {
		t.Fatal(lead1)
	}
	lead2 := env.Put("/photos/"+idOf(second)+"/lead", nil, owner).Expect(t, http.StatusOK).Map(t)
	if lead2["lead"] != true {
		t.Fatal(lead2)
	}
	if env.Get("/photos/"+idOf(first), nil).Map(t)["lead"] != false {
		t.Fatal("first photo is still the lead")
	}
}

func TestSetLeadRequiresApprovedState(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	photo := created(t, env, owner, map[string]string{"speciesId": species.String()})
	response := env.Put("/photos/"+idOf(photo)+"/lead", nil, owner).Expect(t, http.StatusConflict)
	if response.Map(t)["code"] != "conflict" {
		t.Fatal(string(response.Body))
	}
}

func TestSetLeadForbiddenForNonOwner(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	photo := approvedPhoto(t, env, owner, species)
	stranger := signIn(t, env, makeUser(t, env, "stranger"))
	env.Put("/photos/"+idOf(photo)+"/lead", nil, stranger).Expect(t, http.StatusForbidden)
}

func TestSetLeadForbiddenForOwnerWithoutReviewRight(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	photo := approvedPhoto(t, env, owner, species)
	owner = signIn(t, env, *owner)
	env.Put("/photos/"+idOf(photo)+"/lead", nil, owner).Expect(t, http.StatusForbidden)
}

func leadOf(t *testing.T, env *testkit.Env, species db.ID) string {
	t.Helper()
	leads, err := shared.PhotoLeads(context.Background(), env.DB, []db.ID{species})
	if err != nil {
		t.Fatal(err)
	}
	lead, ok := leads[species]
	if !ok {
		return ""
	}
	return lead.String()
}

func TestApprovalBecomesLeadPhotoWithoutExplicitCall(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	photo := approvedPhoto(t, env, owner, species)
	if photo["lead"] != true || leadOf(t, env, species) != idOf(photo) {
		t.Fatal(photo)
	}
}

func TestApprovalKeepsTheFirstLeadPhoto(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	first := approvedPhoto(t, env, owner, species)
	second := approvedPhoto(t, env, owner, species)
	if second["lead"] != false || leadOf(t, env, species) != idOf(first) {
		t.Fatal(second)
	}
}

func TestExplicitLeadWinsOverFirstApprovedPhoto(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	approvedPhoto(t, env, owner, species)
	second := approvedPhoto(t, env, owner, species)
	env.Put("/photos/"+idOf(second)+"/lead", nil, owner).Expect(t, http.StatusOK)
	if leadOf(t, env, species) != idOf(second) {
		t.Fatal("explicit lead lost")
	}
}

func TestRejectedPhotoNeverBecomesLeadPhoto(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	photo := created(t, env, owner, map[string]string{"speciesId": species.String()})
	env.Post("/photos/"+idOf(photo)+"/rejection", map[string]any{"reason": "unscharf"}, owner).Expect(t, http.StatusOK)
	if leadOf(t, env, species) != "" {
		t.Fatal("rejected photo is the lead")
	}
}

func TestDeletingLeadPhotoFallsBackToRemainingApprovedPhoto(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	first := approvedPhoto(t, env, owner, species)
	second := approvedPhoto(t, env, owner, species)
	env.Delete("/photos/"+idOf(first), owner).Expect(t, http.StatusNoContent)
	if leadOf(t, env, species) != idOf(second) {
		t.Fatal("no fallback lead")
	}
}

func TestListWithoutSignInShowsOnlyApprovedSpeciesPhotos(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	approved := approvedPhoto(t, env, owner, species)
	private := created(t, env, owner, none())
	found := ids(t, env.Get("/photos", nil))
	if !found[idOf(approved)] || found[idOf(private)] {
		t.Fatal(found)
	}
}

func TestListMineRequiresSignIn(t *testing.T) {
	env := newEnv(t)
	env.Get("/photos?mine=true", nil).Expect(t, http.StatusUnauthorized)
}

func TestListMineReturnsOwn(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	photo := created(t, env, user, none())
	if !ids(t, env.Get("/photos?mine=true", user))[idOf(photo)] {
		t.Fatal("own photo missing")
	}
}

func TestListSubmittedWithoutReviewRightShowsOnlyOwn(t *testing.T) {
	env := newEnv(t)
	owner := signIn(t, env, makeUser(t, env, "owner"), submit)
	other := signIn(t, env, makeUser(t, env, "other"), submit)
	species := makeSpecies(t, env, "boletus-edulis", enums.ProtectionNone)
	mine := created(t, env, owner, map[string]string{"speciesId": species.String()})
	theirs := created(t, env, other, map[string]string{"speciesId": species.String()})
	found := ids(t, env.Get("/photos?state=submitted", other))
	if !found[idOf(theirs)] || found[idOf(mine)] {
		t.Fatal(found)
	}
}

func TestGetPhotoNotFoundForInvisible(t *testing.T) {
	env := newEnv(t)
	owner := signIn(t, env, makeUser(t, env, "owner"), submit)
	stranger := signIn(t, env, makeUser(t, env, "stranger"))
	photo := created(t, env, owner, none())
	env.Get("/photos/"+idOf(photo), stranger).Expect(t, http.StatusNotFound)
	env.Get("/photos/"+idOf(photo), owner).Expect(t, http.StatusOK)
}

func TestGetPhotoUnknownIDIsNotFound(t *testing.T) {
	env := newEnv(t)
	env.Get("/photos/"+db.NewID().String(), nil).Expect(t, http.StatusNotFound)
}

func TestPhotoFileReturnsJPEGWithCacheHeader(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	photo := created(t, env, user, none())
	response := env.Get("/photos/"+idOf(photo)+"/thumb", user).Expect(t, http.StatusOK)
	if response.Header.Get("Content-Type") != "image/jpeg" ||
		response.Header.Get("Cache-Control") != "public, max-age=31536000, immutable" ||
		len(response.Body) < 2 || response.Body[0] != 0xff || response.Body[1] != 0xd8 {
		t.Fatal(response.Header)
	}
}

func TestPhotoFileOfInvisiblePhotoIsNotFound(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	photo := created(t, env, user, none())
	env.Get("/photos/"+idOf(photo)+"/full", nil).Expect(t, http.StatusNotFound)
}

func TestPhotoFileMissingOnDiskIsNotFound(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	photo := created(t, env, user, none())
	folder := filepath.Join(env.Settings.Photos, idOf(photo))
	entries, err := os.ReadDir(folder)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if err := os.Remove(filepath.Join(folder, entry.Name())); err != nil {
			t.Fatal(err)
		}
	}
	env.Get("/photos/"+idOf(photo)+"/thumb", user).Expect(t, http.StatusNotFound)
}

func TestDeleteByOwnerRemovesRowAndFiles(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	photo := created(t, env, user, none())
	folder := filepath.Join(env.Settings.Photos, idOf(photo))
	if info, err := os.Stat(folder); err != nil || !info.IsDir() {
		t.Fatal("no folder", err)
	}
	env.Delete("/photos/"+idOf(photo), user).Expect(t, http.StatusNoContent)
	if _, err := os.Stat(folder); !os.IsNotExist(err) {
		t.Fatal("folder still exists")
	}
	env.Get("/photos/"+idOf(photo), user).Expect(t, http.StatusNotFound)
}

func TestDeletePrivateByStrangerIsNotFound(t *testing.T) {
	env := newEnv(t)
	owner := signIn(t, env, makeUser(t, env, "owner"), submit)
	stranger := signIn(t, env, makeUser(t, env, "stranger"))
	photo := created(t, env, owner, none())
	env.Delete("/photos/"+idOf(photo), stranger).Expect(t, http.StatusNotFound)
}

func TestDeletePublicPhotoByNonOwnerIsForbidden(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	photo := approvedPhoto(t, env, owner, species)
	stranger := signIn(t, env, makeUser(t, env, "stranger"))
	env.Delete("/photos/"+idOf(photo), stranger).Expect(t, http.StatusForbidden)
}

func TestDeleteByReviewerAllowedForOthersPhoto(t *testing.T) {
	env := newEnv(t)
	owner := signIn(t, env, makeUser(t, env, "owner"), submit)
	photo := created(t, env, owner, none())
	reviewer := signIn(t, env, makeUser(t, env, "reviewer"), review)
	env.Delete("/photos/"+idOf(photo), reviewer).Expect(t, http.StatusNoContent)
}

func TestVisiblePublicApprovedSpeciesPhoto(t *testing.T) {
	owner, species := db.NewID(), db.NewID()
	photo := photos.Photo{OwnerID: &owner, SpeciesID: &species, State: enums.PhotoStateApproved}
	anonymous := auth.Viewer{Rights: map[string]struct{}{}}
	if !photos.Visible(photo, anonymous) {
		t.Fatal("public photo is not visible")
	}
	if photos.Visible(photos.Photo{OwnerID: &owner, State: enums.PhotoStateApproved}, anonymous) {
		t.Fatal("photo without species is visible")
	}
}

func insertPhoto(t *testing.T, env *testkit.Env, owner testkit.Person, species db.ID, state enums.PhotoState, lead bool, createdAt string) db.ID {
	t.Helper()
	id := db.NewID()
	exec(t, env, `INSERT INTO photo (id, owner_id, species_id, width, height, photographer, licence,
		lead, state, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 'x', 'own', ?, ?, ?, ?)`,
		id, userID(t, env, owner), species, lead, string(state), createdAt, createdAt)
	return id
}

func TestRepositoryLeadsMapsSpeciesToLeadPhoto(t *testing.T) {
	env := newEnv(t)
	user := makeUser(t, env, "u")
	species := makeSpecies(t, env, "boletus-edulis", enums.ProtectionNone)
	photo := insertPhoto(t, env, user, species, enums.PhotoStateApproved, true, "2026-01-01 00:00:00.000000")
	if leadOf(t, env, species) != photo.String() {
		t.Fatal("lead missing")
	}
	empty, err := shared.PhotoLeads(context.Background(), env.DB, nil)
	if err != nil || len(empty) != 0 {
		t.Fatal(empty, err)
	}
}

func TestRepositoryLeadsFallsBackToOldestApprovedPhoto(t *testing.T) {
	env := newEnv(t)
	user := makeUser(t, env, "u")
	species := makeSpecies(t, env, "boletus-edulis", enums.ProtectionNone)
	older := insertPhoto(t, env, user, species, enums.PhotoStateApproved, false, "2026-01-01 00:00:00.000000")
	insertPhoto(t, env, user, species, enums.PhotoStateApproved, false, "2026-02-01 00:00:00.000000")
	if leadOf(t, env, species) != older.String() {
		t.Fatal("oldest photo is not the lead")
	}
}

func TestRepositoryLeadsIgnoresRejectedPhotoWithStaleLeadFlag(t *testing.T) {
	env := newEnv(t)
	user := makeUser(t, env, "u")
	species := makeSpecies(t, env, "boletus-edulis", enums.ProtectionNone)
	insertPhoto(t, env, user, species, enums.PhotoStateRejected, true, "2026-01-01 00:00:00.000000")
	if leadOf(t, env, species) != "" {
		t.Fatal("rejected photo is the lead")
	}
}

func TestRepositorySubmissionsReturnsStatePage(t *testing.T) {
	env := newEnv(t)
	user := makeUser(t, env, "u")
	species := makeSpecies(t, env, "boletus-edulis", enums.ProtectionNone)
	photo := insertPhoto(t, env, user, species, enums.PhotoStateSubmitted, false, "2026-01-01 00:00:00.000000")
	reviewer := signIn(t, env, makeUser(t, env, "reviewer"), review)
	if !ids(t, env.Get("/photos?state=submitted&limit=10", reviewer))[photo.String()] {
		t.Fatal("submitted photo missing")
	}
}

func TestSetLeadUnknownPhotoIsNotFound(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), review)
	env.Put("/photos/"+db.NewID().String()+"/lead", nil, user).Expect(t, http.StatusNotFound)
}

func TestSetLeadRequiresSignIn(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	photo := approvedPhoto(t, env, owner, species)
	env.Put("/photos/"+idOf(photo)+"/lead", nil, nil).Expect(t, http.StatusUnauthorized)
}

func TestDeleteRequiresSignIn(t *testing.T) {
	env := newEnv(t)
	owner, species := reviewerOwner(t, env)
	photo := approvedPhoto(t, env, owner, species)
	env.Delete("/photos/"+idOf(photo), nil).Expect(t, http.StatusUnauthorized)
}

func TestListReviewerSeesAllWithoutMine(t *testing.T) {
	env := newEnv(t)
	owner := signIn(t, env, makeUser(t, env, "owner"), submit)
	private := created(t, env, owner, none())
	reviewer := signIn(t, env, makeUser(t, env, "reviewer"), review)
	if !ids(t, env.Get("/photos", reviewer))[idOf(private)] {
		t.Fatal("reviewer misses a private photo")
	}
}

func TestListFiltersBySpeciesAndFind(t *testing.T) {
	env := newEnv(t)
	person := makeUser(t, env, "u")
	speciesA := makeSpecies(t, env, "species-a", enums.ProtectionNone)
	speciesB := makeSpecies(t, env, "species-b", enums.ProtectionNone)
	find := makeFind(t, env, person, &speciesA, 52.523, 13.411)
	user := signIn(t, env, person, review, submit)
	atFind := created(t, env, user, map[string]string{"findId": find.String()})
	atA := created(t, env, user, map[string]string{"speciesId": speciesA.String()})
	atB := created(t, env, user, map[string]string{"speciesId": speciesB.String()})
	bySpecies := ids(t, env.Get("/photos?speciesId="+speciesA.String(), user))
	if len(bySpecies) != 1 || !bySpecies[idOf(atA)] {
		t.Fatal(bySpecies)
	}
	byFind := ids(t, env.Get("/photos?findId="+find.String(), user))
	if len(byFind) != 1 || !byFind[idOf(atFind)] || byFind[idOf(atB)] {
		t.Fatal(byFind)
	}
}

func TestListPagesNewestFirst(t *testing.T) {
	env := newEnv(t)
	user := signIn(t, env, makeUser(t, env, "u"), submit)
	species := makeSpecies(t, env, "boletus-edulis", enums.ProtectionNone)
	older := insertPhoto(t, env, *user, species, enums.PhotoStatePrivate, false, "2026-01-01 00:00:00.000000")
	newer := insertPhoto(t, env, *user, species, enums.PhotoStatePrivate, false, "2026-02-01 00:00:00.000000")
	first := env.Get("/photos?mine=true&limit=1", user).Expect(t, http.StatusOK).Map(t)
	items := first["items"].([]any)
	if len(items) != 1 || idOf(items[0].(map[string]any)) != newer.String() || first["nextCursor"] == nil {
		t.Fatal(first)
	}
	second := env.Get("/photos?mine=true&limit=1&cursor="+first["nextCursor"].(string), user).Expect(t, http.StatusOK).Map(t)
	items = second["items"].([]any)
	if len(items) != 1 || idOf(items[0].(map[string]any)) != older.String() || second["nextCursor"] != nil {
		t.Fatal(second)
	}
}

func TestRemoveOwnerFilesDeletesEachFolderOfThePerson(t *testing.T) {
	env := newEnv(t)
	owner := signIn(t, env, makeUser(t, env, "owner"), submit)
	other := signIn(t, env, makeUser(t, env, "other"), submit)
	mine := created(t, env, owner, none())
	theirs := created(t, env, other, none())
	if err := photos.RemoveOwnerFiles(context.Background(), env.DB, env.Settings.Photos, userID(t, env, *owner)); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(env.Settings.Photos, idOf(mine))); !os.IsNotExist(err) {
		t.Fatal("own folder still exists")
	}
	if _, err := os.Stat(filepath.Join(env.Settings.Photos, idOf(theirs))); err != nil {
		t.Fatal("folder of another person is gone")
	}
}

func expectErrors(t *testing.T, r testkit.Response, pairs ...string) {
	t.Helper()
	errs, _ := r.Map(t)["errors"].([]any)
	if len(errs) != len(pairs)/2 {
		t.Fatalf("errors %s", string(r.Body))
	}
	for i, raw := range errs {
		e := raw.(map[string]any)
		if e["field"] != pairs[2*i] || e["code"] != pairs[2*i+1] {
			t.Fatalf("error %d: %s", i, string(r.Body))
		}
	}
}

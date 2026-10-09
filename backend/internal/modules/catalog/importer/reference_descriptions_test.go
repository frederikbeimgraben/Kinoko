package importer

import (
	"context"
	"testing"
)

func TestTheReferenceDescriptionsAreDraftsInBothLanguages(t *testing.T) {
	handle := openDB(t)
	if err := SeedIfEmpty(context.Background(), handle, realData(t), fixedNow); err != nil {
		t.Fatal(err)
	}
	for _, slug := range []string{"boletus-edulis", "suillus-luteus", "amanita-pantherina"} {
		got := descriptionOf(t, handle, slug)
		if got.german == nil || *got.german == "" || got.english == "" || !got.draft {
			t.Fatalf("%s: %+v", slug, got)
		}
	}
}

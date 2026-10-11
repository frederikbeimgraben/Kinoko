package main

import "testing"

func TestThumbOfBuildsTheStandardThumbnailOfAnOriginal(t *testing.T) {
	original := "https://upload.wikimedia.org/wikipedia/commons/4/44/Russula_vesca.jpg"
	want := "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Russula_vesca.jpg/1920px-Russula_vesca.jpg"
	if got := thumbOf(original, original); got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
	thumb := "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Russula_vesca.jpg/1920px-Russula_vesca.jpg"
	if got := thumbOf(original, thumb); got != thumb {
		t.Fatalf("got %s, want the thumbnail of the API", got)
	}
}

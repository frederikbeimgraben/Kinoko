package fn

import (
	"maps"
	"slices"
	"testing"
)

func TestToMapLetsALaterItemWin(t *testing.T) {
	got := ToMap([]string{"a1", "b2", "a3"}, func(s string) (byte, byte) { return s[0], s[1] })
	if !maps.Equal(got, map[byte]byte{'a': '3', 'b': '2'}) {
		t.Fatal(got)
	}
}

func TestUniqueKeepsTheFirstOrderAndIsNeverNil(t *testing.T) {
	if got := Unique([]int{3, 1, 3, 2, 1}); !slices.Equal(got, []int{3, 1, 2}) {
		t.Fatal(got)
	}
	if got := Unique[string](nil); got == nil {
		t.Fatal("nil")
	}
}

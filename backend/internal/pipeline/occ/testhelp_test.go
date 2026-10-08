package occ_test

import (
	"bytes"
	"compress/gzip"
	"strings"
	"testing"
)

func gz(t *testing.T, lines []string) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	if _, err := w.Write([]byte(strings.Join(lines, "\n") + "\n")); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

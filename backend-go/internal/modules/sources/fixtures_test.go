package sources

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/parquet-go/parquet-go"

	"github.com/frederikbeimgraben/kinoko/backend/internal/core/db"
)

// Sum gives the SHA-256 of data in hex.
func Sum(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

// Column is one column of a parquet fixture: []float64, []float32, []int64 or []string.
type Column struct {
	Name   string
	Values any
}

// WriteParquet writes the columns as a parquet file.
func WriteParquet(t *testing.T, path string, columns []Column) {
	t.Helper()
	group := parquet.Group{}
	byName := map[string]any{}
	rows := 0
	for _, c := range columns {
		byName[c.Name] = c.Values
		switch v := c.Values.(type) {
		case []float64:
			group[c.Name], rows = parquet.Leaf(parquet.DoubleType), len(v)
		case []float32:
			group[c.Name], rows = parquet.Leaf(parquet.FloatType), len(v)
		case []int64:
			group[c.Name], rows = parquet.Int(64), len(v)
		case []string:
			group[c.Name], rows = parquet.String(), len(v)
		default:
			t.Fatalf("column %s: type %T", c.Name, c.Values)
		}
	}
	schema := parquet.NewSchema("fixture", group)
	var buffer bytes.Buffer
	w := parquet.NewWriter(&buffer, schema)
	paths := schema.Columns()
	out := make([]parquet.Row, rows)
	for i := range rows {
		row := make(parquet.Row, len(paths))
		for j, p := range paths {
			var value parquet.Value
			switch v := byName[p[0]].(type) {
			case []float64:
				value = parquet.DoubleValue(v[i])
			case []float32:
				value = parquet.FloatValue(v[i])
			case []int64:
				value = parquet.Int64Value(v[i])
			case []string:
				value = parquet.ByteArrayValue([]byte(v[i]))
			}
			row[j] = value.Level(0, 0, j)
		}
		out[i] = row
	}
	if _, err := w.WriteRows(out); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, buffer.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
}

// ParquetBytes gives the bytes of a parquet file with the columns.
func ParquetBytes(t *testing.T, columns []Column) []byte {
	t.Helper()
	path := filepath.Join(t.TempDir(), "fixture.parquet")
	WriteParquet(t, path, columns)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

// ZipOf packs name → content into a zip archive.
func ZipOf(t *testing.T, files map[string][]byte) []byte {
	t.Helper()
	var buffer bytes.Buffer
	w := zip.NewWriter(&buffer)
	for name, content := range files {
		part, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(content); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

// VersionOn places data as the original file of a new version in a temporary folder.
func VersionOn(t *testing.T, kind Kind, fileName string, data []byte) *Version {
	t.Helper()
	size := int64(len(data))
	v := &Version{ID: db.NewID(), Kind: kind, Number: 1, Origin: OriginUpload, FileName: &fileName,
		SizeBytes: &size, Dir: t.TempDir(), Metadata: map[string]any{}}
	if err := os.WriteFile(v.Original(), data, 0o644); err != nil {
		t.Fatal(err)
	}
	return v
}

// FailCode gives the code of a processor error, or "" for no error.
func FailCode(err error) string {
	if err == nil {
		return ""
	}
	code, _ := failureOf(err, "plain")
	return code
}

// TreesGridColumns gives a trees grid of n cells in one row of the 500 m grid.
func TreesGridColumns(n int) []Column {
	xs, ys, gx, gy, share, pixels := []float64{}, []float64{}, []int64{}, []int64{}, []float32{}, []int64{}
	cells := []string{}
	for i := range n {
		xs = append(xs, 4_000_250+float64(i)*500)
		ys = append(ys, 3_000_250)
		gx, gy = append(gx, int64(i)), append(gy, 0)
		share, pixels = append(share, 0.5), append(pixels, 1250)
		cells = append(cells, strconv.Itoa(8000+i)+"_6000")
	}
	out := []Column{{"x", xs}, {"y", ys}, {"gx", gx}, {"gy", gy}, {"forest_fraction", share},
		{"forest_pixels", pixels}, {"cell", cells}}
	for _, name := range treeColumns() {
		out = append(out, Column{name, share})
	}
	return out
}

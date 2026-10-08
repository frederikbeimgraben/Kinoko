package pio

import (
	"fmt"
	"math"
	"os"
	"path/filepath"
	"reflect"
	"time"

	"github.com/parquet-go/parquet-go"
	"github.com/parquet-go/parquet-go/compress"
	"github.com/parquet-go/parquet-go/encoding"
)

// writeBatch is the number of rows given to the parquet writer in one call.
const writeBatch = 1024

// rowGroupRows is the pyarrow default row group size.
const rowGroupRows = 1 << 20

// WriteParquet writes the columns of schema, in that order, to path.
// It writes a temporary file and renames it, so a reader never sees a partial file.
// Each column is optional like in pandas output: NaN floats and masked rows become null.
func WriteParquet(path string, t *Table, schema []ColumnSpec) (err error) {
	writers, err := columnWriters(t, schema)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".*.tmp")
	if err != nil {
		return fmt.Errorf("pio: %w", err)
	}
	defer func() {
		if err != nil {
			tmp.Close()
			os.Remove(tmp.Name())
		}
	}()
	w := parquet.NewWriter(tmp,
		parquet.NewSchema("schema", orderedGroup(fieldsOf(schema))),
		parquet.Compression(&parquet.Snappy),
		parquet.MaxRowsPerRowGroup(rowGroupRows),
		parquet.CreatedBy("kinoko-pio", "1", ""))
	if err = writeRows(w, t.N, writers); err != nil {
		return fmt.Errorf("pio: %s: %w", path, err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("pio: %s: %w", path, err)
	}
	if err = tmp.Sync(); err != nil {
		return fmt.Errorf("pio: %w", err)
	}
	if err = tmp.Close(); err != nil {
		return fmt.Errorf("pio: %w", err)
	}
	if err = os.Rename(tmp.Name(), path); err != nil {
		return fmt.Errorf("pio: %w", err)
	}
	return nil
}

func writeRows(w *parquet.Writer, n int, writers []func(i int) parquet.Value) error {
	rows := make([]parquet.Row, 0, writeBatch)
	for start := 0; start < n; start += writeBatch {
		end := min(start+writeBatch, n)
		rows = rows[:0]
		for i := start; i < end; i++ {
			row := make(parquet.Row, len(writers))
			for c, value := range writers {
				v := value(i)
				def := 1
				if v.IsNull() {
					def = 0
				}
				row[c] = v.Level(0, def, c)
			}
			rows = append(rows, row)
		}
		if _, err := w.WriteRows(rows); err != nil {
			return err
		}
	}
	return nil
}

// columnWriters checks each column of the schema and gives a function per column
// that gives the parquet value of row i.
func columnWriters(t *Table, schema []ColumnSpec) ([]func(int) parquet.Value, error) {
	out := make([]func(int) parquet.Value, 0, len(schema))
	seen := map[string]bool{}
	for _, spec := range schema {
		if seen[spec.Name] {
			return nil, fmt.Errorf("pio: column %q is two times in the schema", spec.Name)
		}
		seen[spec.Name] = true
		if got := t.columnLen(spec); got != t.N {
			return nil, fmt.Errorf("pio: column %q (%s): length %d, table has %d rows", spec.Name, spec.Type, got, t.N)
		}
		if mask, ok := t.Null[spec.Name]; ok && len(mask) != t.N {
			return nil, fmt.Errorf("pio: column %q: null mask length %d, table has %d rows", spec.Name, len(mask), t.N)
		}
		if err := checkRange(t, spec); err != nil {
			return nil, err
		}
		value, err := valueFunc(t, spec)
		if err != nil {
			return nil, err
		}
		mask := t.Null[spec.Name]
		out = append(out, func(i int) parquet.Value {
			if mask != nil && mask[i] {
				return parquet.NullValue()
			}
			return value(i)
		})
	}
	return out, nil
}

// checkRange tests the values that the stored type cannot hold, so a range error
// does not leave a partial file.
func checkRange(t *Table, spec ColumnSpec) error {
	mask := t.Null[spec.Name]
	masked := func(i int) bool { return mask != nil && mask[i] }
	switch spec.Type {
	case Int8, Int16, Int32:
		lo, hi := intRange(spec.Type)
		for i, v := range t.I64[spec.Name] {
			if !masked(i) && (v < lo || v > hi) {
				return fmt.Errorf("pio: column %q row %d: %d is out of %s range", spec.Name, i, v, spec.Type)
			}
		}
	case Timestamp:
		for i, v := range t.Time[spec.Name] {
			if !masked(i) && (v.Before(minNanoTime) || v.After(maxNanoTime)) {
				return fmt.Errorf("pio: column %q row %d: %s is out of datetime64[ns] range", spec.Name, i, v)
			}
		}
	}
	return nil
}

func valueFunc(t *Table, spec ColumnSpec) (func(int) parquet.Value, error) {
	name := spec.Name
	switch spec.Type {
	case String:
		vals := t.Str[name]
		return func(i int) parquet.Value { return parquet.ByteArrayValue([]byte(vals[i])) }, nil
	case Bool:
		vals := t.Bool[name]
		return func(i int) parquet.Value { return parquet.BooleanValue(vals[i]) }, nil
	case Int8, Int16, Int32:
		vals := t.I64[name]
		return func(i int) parquet.Value { return parquet.Int32Value(int32(vals[i])) }, nil
	case Int64:
		vals := t.I64[name]
		return func(i int) parquet.Value { return parquet.Int64Value(vals[i]) }, nil
	case Float32:
		vals := t.F32[name]
		return func(i int) parquet.Value {
			if math.IsNaN(float64(vals[i])) {
				return parquet.NullValue()
			}
			return parquet.FloatValue(vals[i])
		}, nil
	case Float64:
		vals := t.F64[name]
		return func(i int) parquet.Value {
			if math.IsNaN(vals[i]) {
				return parquet.NullValue()
			}
			return parquet.DoubleValue(vals[i])
		}, nil
	case Timestamp:
		vals := t.Time[name]
		return func(i int) parquet.Value { return parquet.Int64Value(vals[i].UnixNano()) }, nil
	case Date:
		vals := t.Time[name]
		return func(i int) parquet.Value { return parquet.Int32Value(int32(floorDiv(vals[i].Unix(), 86400))) }, nil
	}
	return nil, fmt.Errorf("pio: column %q: type %s cannot be written", name, spec.Type)
}

// intRange gives the bounds of a stored integer type.
func intRange(ct ColType) (int64, int64) {
	switch ct {
	case Int8:
		return math.MinInt8, math.MaxInt8
	case Int16:
		return math.MinInt16, math.MaxInt16
	}
	return math.MinInt32, math.MaxInt32
}

// minNanoTime and maxNanoTime bound the pandas datetime64[ns] range.
var (
	minNanoTime = time.Unix(0, math.MinInt64)
	maxNanoTime = time.Unix(0, math.MaxInt64)
)

func floorDiv(a, b int64) int64 {
	q := a / b
	if a%b != 0 && (a < 0) != (b < 0) {
		q--
	}
	return q
}

// leafNode gives the parquet node that pyarrow writes for a pandas dtype.
func leafNode(ct ColType) parquet.Node {
	switch ct {
	case String:
		return parquet.Encoded(parquet.String(), &parquet.RLEDictionary)
	case Bool:
		return parquet.Leaf(parquet.BooleanType)
	case Int8:
		return parquet.Int(8)
	case Int16:
		return parquet.Int(16)
	case Int32:
		return parquet.Leaf(parquet.Int32Type)
	case Int64:
		return parquet.Leaf(parquet.Int64Type)
	case Float32:
		return parquet.Leaf(parquet.FloatType)
	case Float64:
		return parquet.Leaf(parquet.DoubleType)
	case Timestamp:
		return parquet.TimestampAdjusted(parquet.Nanosecond, false)
	}
	return parquet.Date()
}

func fieldsOf(schema []ColumnSpec) []parquet.Field {
	out := make([]parquet.Field, len(schema))
	for i, spec := range schema {
		out[i] = &namedField{Node: parquet.Optional(leafNode(spec.Type)), name: spec.Name}
	}
	return out
}

// orderedGroup is a parquet group that keeps the field order of the caller.
// parquet.Group sorts its fields by name, but the column order of the pandas tables matters.
type orderedGroup []parquet.Field

func (g orderedGroup) ID() int                     { return 0 }
func (g orderedGroup) String() string              { return "orderedGroup" }
func (g orderedGroup) Type() parquet.Type          { return parquet.Group{}.Type() }
func (g orderedGroup) Optional() bool              { return false }
func (g orderedGroup) Repeated() bool              { return false }
func (g orderedGroup) Required() bool              { return true }
func (g orderedGroup) Leaf() bool                  { return false }
func (g orderedGroup) Fields() []parquet.Field     { return g }
func (g orderedGroup) Encoding() encoding.Encoding { return nil }
func (g orderedGroup) Compression() compress.Codec { return nil }
func (g orderedGroup) GoType() reflect.Type        { return reflect.TypeFor[map[string]any]() }

// namedField gives a node a name in its parent group.
type namedField struct {
	parquet.Node
	name string
}

func (f *namedField) Name() string { return f.name }

func (f *namedField) Value(base reflect.Value) reflect.Value {
	return base.MapIndex(reflect.ValueOf(f.name))
}

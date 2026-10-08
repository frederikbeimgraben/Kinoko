package pio

import (
	"fmt"
	"math"
	"time"

	"github.com/parquet-go/parquet-go"
	"github.com/parquet-go/parquet-go/deprecated"
	"github.com/parquet-go/parquet-go/format"
)

// julianUnixEpoch is the Julian day number of 1970-01-01, the base of INT96 timestamps.
const julianUnixEpoch = 2440588

// colInfo describes how to read a parquet leaf column.
// nanos converts a stored time integer to nanoseconds.
type colInfo struct {
	typ      ColType
	nanos    int64
	unsigned bool
}

// fileColInfo gives the pandas type of a parquet leaf column.
func fileColInfo(col *parquet.Column) (colInfo, error) {
	ct, nanos, err := fileColType(col)
	return colInfo{typ: ct, nanos: nanos, unsigned: isUnsigned32(col.Type())}, err
}

// isUnsigned32 tells if an INT32 column holds unsigned values.
func isUnsigned32(typ parquet.Type) bool {
	if typ.Kind() != parquet.Int32 {
		return false
	}
	if l := typ.LogicalType(); l != nil {
		if it, ok := l.Value.(*format.IntType); ok {
			return !it.IsSigned
		}
	}
	ct := typ.ConvertedType()
	return ct != nil && (*ct == deprecated.Uint8 || *ct == deprecated.Uint16 || *ct == deprecated.Uint32)
}

func fileColType(col *parquet.Column) (ColType, int64, error) {
	typ := col.Type()
	logical := typ.LogicalType()
	var lv format.LogicalTypeValue
	if logical != nil {
		lv = logical.Value
	}
	switch typ.Kind() {
	case parquet.Boolean:
		return Bool, 0, nil
	case parquet.Int32:
		switch l := lv.(type) {
		case *format.DateType:
			return Date, 0, nil
		case *format.IntType:
			return intColType(int(l.BitWidth), l.IsSigned), 0, nil
		case nil:
			return convertedInt32(typ.ConvertedType()), 0, nil
		}
	case parquet.Int64:
		switch l := lv.(type) {
		case *format.TimestampType:
			return Timestamp, unitNanos(l.Unit), nil
		case *format.IntType:
			return Int64, 0, nil
		case nil:
			return convertedInt64(typ.ConvertedType())
		}
	case parquet.Int96:
		return Timestamp, 0, nil
	case parquet.Float:
		return Float32, 0, nil
	case parquet.Double:
		return Float64, 0, nil
	case parquet.ByteArray, parquet.FixedLenByteArray:
		switch lv.(type) {
		case nil, *format.StringType, *format.EnumType, *format.JsonType:
			return String, 0, nil
		}
	}
	return Any, 0, fmt.Errorf("pio: column %q has unsupported type %s", col.Name(), typ)
}

// intColType gives the smallest signed type that holds each value of the stored integer.
func intColType(bits int, signed bool) ColType {
	if !signed {
		bits *= 2
	}
	switch {
	case bits <= 8:
		return Int8
	case bits <= 16:
		return Int16
	case bits <= 32:
		return Int32
	}
	return Int64
}

func convertedInt32(ct *deprecated.ConvertedType) ColType {
	if ct == nil {
		return Int32
	}
	switch *ct {
	case deprecated.Int8:
		return Int8
	case deprecated.Int16, deprecated.Uint8:
		return Int16
	case deprecated.Uint16:
		return Int32
	case deprecated.Uint32:
		return Int64
	case deprecated.Date:
		return Date
	}
	return Int32
}

func convertedInt64(ct *deprecated.ConvertedType) (ColType, int64, error) {
	if ct == nil {
		return Int64, 0, nil
	}
	switch *ct {
	case deprecated.TimestampMillis:
		return Timestamp, int64(time.Millisecond), nil
	case deprecated.TimestampMicros:
		return Timestamp, int64(time.Microsecond), nil
	}
	return Int64, 0, nil
}

func unitNanos(u format.TimeUnit) int64 {
	switch u.Value.(type) {
	case *format.MilliSeconds:
		return int64(time.Millisecond)
	case *format.MicroSeconds:
		return int64(time.Microsecond)
	}
	return 1
}

// accumulator collects the values of one column in a table field.
type accumulator interface {
	add(v parquet.Value)
	store(t *Table, name string)
}

// acc collects typed values. A null becomes nullValue; floats keep no null mask
// because pandas reads a null float as NaN.
type acc[T any] struct {
	vals      []T
	null      []bool
	hasNull   bool
	nanIsNull bool
	nullValue T
	conv      func(parquet.Value) T
	put       func(t *Table, name string, vals []T)
}

func (a *acc[T]) add(v parquet.Value) {
	isNull := v.IsNull()
	if isNull {
		a.vals = append(a.vals, a.nullValue)
	} else {
		a.vals = append(a.vals, a.conv(v))
	}
	if a.nanIsNull {
		return
	}
	a.null = append(a.null, isNull)
	a.hasNull = a.hasNull || isNull
}

func (a *acc[T]) store(t *Table, name string) {
	a.put(t, name, a.vals)
	if a.hasNull {
		t.Null[name] = a.null
	}
}

// newAccumulator gives the accumulator for a column with room for n rows.
func newAccumulator(info colInfo, n int) accumulator {
	ct := info.typ
	switch {
	case ct == String:
		return &acc[string]{vals: make([]string, 0, n), null: make([]bool, 0, n),
			conv: interner(),
			put:  func(t *Table, name string, vals []string) { t.Str[name] = vals }}
	case ct == Bool:
		return &acc[bool]{vals: make([]bool, 0, n), null: make([]bool, 0, n),
			conv: parquet.Value.Boolean,
			put:  func(t *Table, name string, vals []bool) { t.Bool[name] = vals }}
	case ct.IsInt():
		return &acc[int64]{vals: make([]int64, 0, n), null: make([]bool, 0, n),
			conv: intConverter(info.unsigned),
			put:  func(t *Table, name string, vals []int64) { t.I64[name] = vals }}
	case ct == Float32:
		return &acc[float32]{vals: make([]float32, 0, n), nanIsNull: true, nullValue: float32(math.NaN()),
			conv: parquet.Value.Float,
			put:  func(t *Table, name string, vals []float32) { t.F32[name] = vals }}
	case ct == Float64:
		return &acc[float64]{vals: make([]float64, 0, n), nanIsNull: true, nullValue: math.NaN(),
			conv: parquet.Value.Double,
			put:  func(t *Table, name string, vals []float64) { t.F64[name] = vals }}
	}
	return &acc[time.Time]{vals: make([]time.Time, 0, n), null: make([]bool, 0, n),
		conv: timeConverter(ct, info.nanos),
		put:  func(t *Table, name string, vals []time.Time) { t.Time[name] = vals }}
}

// intConverter widens a stored integer. An unsigned INT32 keeps its value above 2^31.
func intConverter(unsigned bool) func(parquet.Value) int64 {
	return func(v parquet.Value) int64 {
		switch {
		case v.Kind() != parquet.Int32:
			return v.Int64()
		case unsigned:
			return int64(v.Uint32())
		}
		return int64(v.Int32())
	}
}

func timeConverter(ct ColType, nanos int64) func(parquet.Value) time.Time {
	if ct == Date {
		return func(v parquet.Value) time.Time {
			return time.Unix(int64(v.Int32())*86400, 0).UTC()
		}
	}
	return func(v parquet.Value) time.Time {
		if v.Kind() == parquet.Int96 {
			i := v.Int96()
			ns := int64(uint64(i[1])<<32 | uint64(i[0]))
			days := int64(i[2]) - julianUnixEpoch
			return time.Unix(days*86400, ns).UTC()
		}
		return time.Unix(0, v.Int64()*nanos).UTC()
	}
}

// maxInterned bounds the strings that one column shares. Above it, a column of unique
// values such as gbifID gets no benefit, so each value gets its own copy.
const maxInterned = 1 << 16

// interner gives a string converter that shares equal values. The cell column of the
// weather table repeats about 15k values over 10M rows.
func interner() func(parquet.Value) string {
	seen := map[string]string{}
	return func(v parquet.Value) string {
		b := v.ByteArray()
		if s, ok := seen[string(b)]; ok {
			return s
		}
		s := string(b)
		if len(seen) < maxInterned {
			seen[s] = s
		}
		return s
	}
}

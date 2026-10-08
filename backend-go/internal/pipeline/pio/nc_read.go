package pio

/*
#include <netcdf.h>
*/
import "C"

import (
	"fmt"
	"math"
	"unsafe"
)

// ReadDays reads n days from day t0 of the variable v with dims (time, y, x) into dst.
// dst holds n*ny*nx values in [t][y][x] order. Fill values become NaN, and scale_factor
// and add_offset are applied with the float type that xarray chooses.
func (f *NCFile) ReadDays(v string, t0, n int, dst []float32) error {
	start, count, err := f.daySlab(v, t0, n, len(dst))
	if err != nil {
		return err
	}
	p, err := f.packingOf(v)
	if err != nil {
		return err
	}
	if !p.Wide {
		return f.readSlab32(v, p, start, count, dst)
	}
	wide := make([]float64, len(dst))
	if err := f.readSlab64(v, start, count, wide); err != nil {
		return err
	}
	for i, x := range wide {
		dst[i] = float32(x)
	}
	return nil
}

// ReadDays64 is ReadDays with float64 output. Use it when xarray decodes the variable
// to float64, for example int32 data or a float64 scale_factor, and the precision matters.
func (f *NCFile) ReadDays64(v string, t0, n int, dst []float64) error {
	start, count, err := f.daySlab(v, t0, n, len(dst))
	if err != nil {
		return err
	}
	return f.readSlab64(v, start, count, dst)
}

// Packing gives the CF decode rules of variable v.
func (f *NCFile) Packing(v string) (Packing, error) {
	return f.packingOf(v)
}

func (f *NCFile) daySlab(v string, t0, n, size int) ([]int, []int, error) {
	dims, err := f.Dims(v)
	if err != nil {
		return nil, nil, err
	}
	if len(dims) != 3 || dims[0].Name != "time" || dims[1].Name != "y" || dims[2].Name != "x" {
		return nil, nil, fmt.Errorf("pio: %s: %s has dims %v, expected (time, y, x)", f.path, v, dims)
	}
	if t0 < 0 || n < 0 || t0+n > dims[0].Len {
		return nil, nil, fmt.Errorf("pio: %s: days %d..%d are out of 0..%d", f.path, t0, t0+n, dims[0].Len)
	}
	if want := n * dims[1].Len * dims[2].Len; size != want {
		return nil, nil, fmt.Errorf("pio: %s: dst has %d values, expected %d", f.path, size, want)
	}
	return []int{t0, 0, 0}, []int{n, dims[1].Len, dims[2].Len}, nil
}

func (f *NCFile) packingOf(v string) (Packing, error) {
	ncMu.Lock()
	defer ncMu.Unlock()
	varid, err := f.varID(v)
	if err != nil {
		return Packing{}, err
	}
	raw, err := f.varType(varid)
	if err != nil {
		return Packing{}, err
	}
	fill, _, err := f.attNumbers(varid, "_FillValue")
	if err != nil {
		return Packing{}, err
	}
	missing, _, err := f.attNumbers(varid, "missing_value")
	if err != nil {
		return Packing{}, err
	}
	scale, scaleType, err := f.attNumbers(varid, "scale_factor")
	if err != nil {
		return Packing{}, err
	}
	offset, offsetType, err := f.attNumbers(varid, "add_offset")
	if err != nil {
		return Packing{}, err
	}
	return NewPacking(numType(raw), append(fill, missing...),
		attValue(scale, scaleType), attValue(offset, offsetType)), nil
}

func attValue(values []float64, t C.nc_type) *Att {
	if len(values) == 0 {
		return nil
	}
	return &Att{Value: values[0], Type: numType(t)}
}

func numType(t C.nc_type) NumType {
	switch t {
	case C.NC_BYTE, C.NC_SHORT, C.NC_UBYTE, C.NC_USHORT:
		return NumSmallInt
	case C.NC_INT, C.NC_UINT:
		return NumInt32
	case C.NC_FLOAT:
		return NumFloat32
	case C.NC_DOUBLE:
		return NumFloat64
	}
	return NumInt64
}

func (f *NCFile) readSlab32(v string, p Packing, start, count []int, dst []float32) error {
	if len(dst) == 0 {
		return nil
	}
	ncMu.Lock()
	defer ncMu.Unlock()
	varid, err := f.varID(v)
	if err != nil {
		return err
	}
	cs, cc := sizes(start), sizes(count)
	if err := ncErr(C.nc_get_vara_float(f.id, varid, &cs[0], &cc[0], (*C.float)(unsafe.Pointer(&dst[0])))); err != nil {
		return fmt.Errorf("pio: %s: read %s: %w", f.path, v, err)
	}
	for i, x := range dst {
		dst[i] = p.Decode32(x)
	}
	return nil
}

func (f *NCFile) readSlab64(v string, start, count []int, dst []float64) error {
	p, err := f.packingOf(v)
	if err != nil {
		return err
	}
	if len(dst) == 0 {
		return nil
	}
	ncMu.Lock()
	defer ncMu.Unlock()
	varid, err := f.varID(v)
	if err != nil {
		return err
	}
	cs, cc := sizes(start), sizes(count)
	if len(cs) == 0 {
		cs, cc = []C.size_t{0}, []C.size_t{1}
	}
	if err := ncErr(C.nc_get_vara_double(f.id, varid, &cs[0], &cc[0], (*C.double)(unsafe.Pointer(&dst[0])))); err != nil {
		return fmt.Errorf("pio: %s: read %s: %w", f.path, v, err)
	}
	decode := p.Decode64
	if !p.Wide {
		decode = func(x float64) float64 { return float64(p.Decode32(float32(x))) }
	}
	for i, x := range dst {
		dst[i] = decode(x)
	}
	return nil
}

func sizes(v []int) []C.size_t {
	out := make([]C.size_t, len(v))
	for i, x := range v {
		out[i] = C.size_t(x)
	}
	return out
}

// nan32 is the float32 NaN that a masked value becomes.
var nan32 = float32(math.NaN())

package pio

/*
#cgo pkg-config: netcdf
#include <stdlib.h>
#include <netcdf.h>
*/
import "C"

import (
	"fmt"
	"sync"
	"time"
	"unsafe"
)

// ncMu serialises each libnetcdf call. libnetcdf and HDF5 are not thread-safe.
var ncMu sync.Mutex

// NCFile is an open netCDF file. Its methods are safe for concurrent use.
type NCFile struct {
	path string
	id   C.int
}

// Dim is a dimension of a netCDF variable.
type Dim struct {
	Name string
	Len  int
}

// OpenNC opens a netCDF file to read.
func OpenNC(path string) (*NCFile, error) {
	cpath := C.CString(path)
	defer C.free(unsafe.Pointer(cpath))
	ncMu.Lock()
	defer ncMu.Unlock()
	var id C.int
	if err := ncErr(C.nc_open(cpath, C.NC_NOWRITE, &id)); err != nil {
		return nil, fmt.Errorf("pio: open %s: %w", path, err)
	}
	return &NCFile{path: path, id: id}, nil
}

// Close closes the file.
func (f *NCFile) Close() error {
	ncMu.Lock()
	defer ncMu.Unlock()
	if err := ncErr(C.nc_close(f.id)); err != nil {
		return fmt.Errorf("pio: close %s: %w", f.path, err)
	}
	return nil
}

// Dims gives the dimensions of variable v in storage order.
func (f *NCFile) Dims(v string) ([]Dim, error) {
	ncMu.Lock()
	defer ncMu.Unlock()
	varid, err := f.varID(v)
	if err != nil {
		return nil, err
	}
	return f.dims(varid)
}

// Coords gives the 1-D x and y coordinates and the days of the time axis.
// Each time is decoded from its CF units and set to midnight, as pandas normalize() does.
func (f *NCFile) Coords() (x, y []float64, days []time.Time, err error) {
	if x, err = f.ReadVar64("x"); err != nil {
		return nil, nil, nil, err
	}
	if y, err = f.ReadVar64("y"); err != nil {
		return nil, nil, nil, err
	}
	days, err = f.Days("time")
	return x, y, days, err
}

// Days decodes a CF time variable and sets each time to midnight.
func (f *NCFile) Days(v string) ([]time.Time, error) {
	values, units, calendar, err := f.timeVar(v)
	if err != nil {
		return nil, err
	}
	times, err := DecodeCFTime(values, units, calendar)
	if err != nil {
		return nil, fmt.Errorf("pio: %s: %s: %w", f.path, v, err)
	}
	for i, t := range times {
		times[i] = Normalize(t)
	}
	return times, nil
}

func (f *NCFile) timeVar(v string) (values []float64, units, calendar string, err error) {
	ncMu.Lock()
	defer ncMu.Unlock()
	varid, err := f.varID(v)
	if err != nil {
		return nil, "", "", err
	}
	if units, _, err = f.attText(varid, "units"); err != nil {
		return nil, "", "", err
	}
	if calendar, _, err = f.attText(varid, "calendar"); err != nil {
		return nil, "", "", err
	}
	n, err := f.varLen(varid)
	if err != nil {
		return nil, "", "", err
	}
	values = make([]float64, n)
	if n > 0 {
		if err := ncErr(C.nc_get_var_double(f.id, varid, (*C.double)(unsafe.Pointer(&values[0])))); err != nil {
			return nil, "", "", fmt.Errorf("pio: %s: read %s: %w", f.path, v, err)
		}
	}
	return values, units, calendar, nil
}

// ReadVar64 reads a whole variable with mask and scale applied, in storage order.
func (f *NCFile) ReadVar64(v string) ([]float64, error) {
	dims, err := f.Dims(v)
	if err != nil {
		return nil, err
	}
	start := make([]int, len(dims))
	count := make([]int, len(dims))
	n := 1
	for i, d := range dims {
		count[i] = d.Len
		n *= d.Len
	}
	dst := make([]float64, n)
	return dst, f.readSlab64(v, start, count, dst)
}

func (f *NCFile) varID(v string) (C.int, error) {
	cname := C.CString(v)
	defer C.free(unsafe.Pointer(cname))
	var varid C.int
	if err := ncErr(C.nc_inq_varid(f.id, cname, &varid)); err != nil {
		return 0, fmt.Errorf("pio: %s: variable %q: %w", f.path, v, err)
	}
	return varid, nil
}

func (f *NCFile) dims(varid C.int) ([]Dim, error) {
	var ndims C.int
	if err := ncErr(C.nc_inq_varndims(f.id, varid, &ndims)); err != nil {
		return nil, fmt.Errorf("pio: %s: %w", f.path, err)
	}
	ids := make([]C.int, max(int(ndims), 1))
	if err := ncErr(C.nc_inq_vardimid(f.id, varid, &ids[0])); err != nil {
		return nil, fmt.Errorf("pio: %s: %w", f.path, err)
	}
	out := make([]Dim, ndims)
	name := make([]C.char, C.NC_MAX_NAME+1)
	for i := range out {
		var n C.size_t
		if err := ncErr(C.nc_inq_dim(f.id, ids[i], &name[0], &n)); err != nil {
			return nil, fmt.Errorf("pio: %s: %w", f.path, err)
		}
		out[i] = Dim{Name: C.GoString(&name[0]), Len: int(n)}
	}
	return out, nil
}

func (f *NCFile) varLen(varid C.int) (int, error) {
	dims, err := f.dims(varid)
	if err != nil {
		return 0, err
	}
	n := 1
	for _, d := range dims {
		n *= d.Len
	}
	return n, nil
}

func (f *NCFile) varType(varid C.int) (C.nc_type, error) {
	var t C.nc_type
	if err := ncErr(C.nc_inq_vartype(f.id, varid, &t)); err != nil {
		return 0, fmt.Errorf("pio: %s: %w", f.path, err)
	}
	return t, nil
}

// attText reads a text attribute. A missing attribute gives ok false and no error.
func (f *NCFile) attText(varid C.int, name string) (string, bool, error) {
	cname := C.CString(name)
	defer C.free(unsafe.Pointer(cname))
	var t C.nc_type
	var n C.size_t
	if C.nc_inq_att(f.id, varid, cname, &t, &n) != C.NC_NOERR {
		return "", false, nil
	}
	switch t {
	case C.NC_CHAR:
		buf := make([]byte, int(n)+1)
		if err := ncErr(C.nc_get_att_text(f.id, varid, cname, (*C.char)(unsafe.Pointer(&buf[0])))); err != nil {
			return "", false, fmt.Errorf("pio: %s: attribute %s: %w", f.path, name, err)
		}
		return trimNul(buf[:n]), true, nil
	case C.NC_STRING:
		ptrs := make([]*C.char, max(int(n), 1))
		if err := ncErr(C.nc_get_att_string(f.id, varid, cname, &ptrs[0])); err != nil {
			return "", false, fmt.Errorf("pio: %s: attribute %s: %w", f.path, name, err)
		}
		defer C.nc_free_string(n, &ptrs[0])
		if n == 0 {
			return "", true, nil
		}
		return C.GoString(ptrs[0]), true, nil
	}
	return "", false, fmt.Errorf("pio: %s: attribute %s is not text", f.path, name)
}

// attNumbers reads a numeric attribute and its netCDF type. A missing attribute gives nil.
func (f *NCFile) attNumbers(varid C.int, name string) ([]float64, C.nc_type, error) {
	cname := C.CString(name)
	defer C.free(unsafe.Pointer(cname))
	var t C.nc_type
	var n C.size_t
	if C.nc_inq_att(f.id, varid, cname, &t, &n) != C.NC_NOERR || n == 0 {
		return nil, 0, nil
	}
	if t == C.NC_CHAR || t == C.NC_STRING {
		return nil, 0, fmt.Errorf("pio: %s: attribute %s is text, not a number", f.path, name)
	}
	out := make([]float64, n)
	if err := ncErr(C.nc_get_att_double(f.id, varid, cname, (*C.double)(unsafe.Pointer(&out[0])))); err != nil {
		return nil, 0, fmt.Errorf("pio: %s: attribute %s: %w", f.path, name, err)
	}
	return out, t, nil
}

func trimNul(b []byte) string {
	for i, c := range b {
		if c == 0 {
			return string(b[:i])
		}
	}
	return string(b)
}

// ncError is an error status of libnetcdf.
type ncError struct {
	code C.int
}

func (e ncError) Error() string { return C.GoString(C.nc_strerror(e.code)) }

func ncErr(code C.int) error {
	if code == C.NC_NOERR {
		return nil
	}
	return ncError{code: code}
}

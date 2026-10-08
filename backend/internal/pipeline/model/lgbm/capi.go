// Package lgbm is a small cgo wrapper over the LightGBM 4.6 C API.
// It trains binary models on dense matrices, saves and loads model text and predicts.
package lgbm

/*
#cgo LDFLAGS: -l_lightgbm
#include "lgbm_api.h"
*/
import "C"

import (
	"errors"
	"fmt"
	"runtime"
	"unsafe"
)

// The values of the C_API_* macros in c_api.h. The header includes C++ headers, so cgo cannot read it.
const (
	dtypeFloat32     = 0
	dtypeFloat64     = 1
	predictNormal    = 0
	importanceSplit  = 0
	importanceGain   = 1
	allIterations    = -1
	firstIteration   = 0
	rowMajor         = 1
	featureNameBytes = 256
)

// ErrClosed is the error of a call on a closed Dataset or Booster.
var ErrClosed = errors.New("lgbm: handle is closed")

// call runs one C API call and reads the error text on the same OS thread.
// LightGBM keeps the last error in thread-local storage, so a thread switch would lose it.
func call(op string, f func() C.int) error {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	if f() == 0 {
		return nil
	}
	return fmt.Errorf("lgbm: %s: %s", op, C.GoString(C.LGBM_GetLastError()))
}

// cStrings copies names into C memory. Call the returned function to free it.
func cStrings(names []string) (**C.char, func()) {
	if len(names) == 0 {
		return nil, func() {}
	}
	size := C.size_t(len(names)) * C.size_t(unsafe.Sizeof(uintptr(0)))
	array := (**C.char)(C.malloc(size))
	items := unsafe.Slice(array, len(names))
	for i, name := range names {
		items[i] = C.CString(name)
	}
	return array, func() {
		for _, item := range items {
			C.free(unsafe.Pointer(item))
		}
		C.free(unsafe.Pointer(array))
	}
}

// cString copies s into C memory. Call the returned function to free it.
func cString(s string) (*C.char, func()) {
	p := C.CString(s)
	return p, func() { C.free(unsafe.Pointer(p)) }
}

// checkShape makes sure that a row-major matrix has nrow*ncol values and fits the int32 of the C API.
func checkShape(n, nrow, ncol int) error {
	if nrow < 0 || ncol <= 0 || n != nrow*ncol {
		return fmt.Errorf("lgbm: matrix has %d values, not %d x %d", n, nrow, ncol)
	}
	if nrow > 1<<31-1 || ncol > 1<<31-1 {
		return fmt.Errorf("lgbm: matrix %d x %d is too large", nrow, ncol)
	}
	return nil
}

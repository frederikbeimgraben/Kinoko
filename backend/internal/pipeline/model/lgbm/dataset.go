package lgbm

/*
#include "lgbm_api.h"
*/
import "C"

import (
	"fmt"
	"runtime"
	"sync"
	"unsafe"
)

// Float is the element type of a matrix that LightGBM reads without a copy to another type.
type Float interface{ ~float32 | ~float64 }

// datasetHandle owns the C dataset. A Booster trained on it keeps a reference,
// because LightGBM keeps a raw pointer to its training data.
type datasetHandle struct {
	mu   sync.Mutex
	h    C.DatasetHandle
	refs int
}

func (d *datasetHandle) retain() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.refs++
}

func (d *datasetHandle) release() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.refs--
	if d.refs == 0 && d.h != nil {
		C.LGBM_DatasetFree(d.h)
		d.h = nil
	}
}

// Dataset is a LightGBM training set. Call Close when it is no longer needed.
// A finalizer frees it if Close is not called.
type Dataset struct {
	mu      sync.Mutex
	inner   *datasetHandle
	cleanup runtime.Cleanup
	rows    int
	cols    int
}

// NewDataset bins a row-major matrix of nrow x ncol values. NaN is a missing value.
// The label has one value per row. names gives the feature names, or is empty.
func NewDataset[T Float](x []T, nrow, ncol int, label []float32, names []string, params string) (*Dataset, error) {
	if err := checkShape(len(x), nrow, ncol); err != nil {
		return nil, err
	}
	if len(label) != nrow {
		return nil, fmt.Errorf("lgbm: %d labels for %d rows", len(label), nrow)
	}
	if len(names) != 0 && len(names) != ncol {
		return nil, fmt.Errorf("lgbm: %d feature names for %d columns", len(names), ncol)
	}
	if nrow == 0 {
		return nil, fmt.Errorf("lgbm: dataset has no rows")
	}
	cparams, free := cString(params)
	defer free()
	var h C.DatasetHandle
	err := call("DatasetCreateFromMat", func() C.int {
		return C.LGBM_DatasetCreateFromMat(unsafe.Pointer(&x[0]), C.int(dtypeOf(x)),
			C.int32_t(nrow), C.int32_t(ncol), rowMajor, cparams, nil, &h)
	})
	runtime.KeepAlive(x)
	if err != nil {
		return nil, err
	}
	inner := &datasetHandle{h: h, refs: 1}
	if err := setLabelAndNames(h, label, names); err != nil {
		inner.release()
		return nil, err
	}
	ds := &Dataset{inner: inner, rows: nrow, cols: ncol}
	ds.cleanup = runtime.AddCleanup(ds, (*datasetHandle).release, inner)
	return ds, nil
}

func dtypeOf[T Float](x []T) int {
	var zero T
	if unsafe.Sizeof(zero) == 4 {
		return dtypeFloat32
	}
	return dtypeFloat64
}

func setLabelAndNames(h C.DatasetHandle, label []float32, names []string) error {
	field, free := cString("label")
	defer free()
	err := call("DatasetSetField(label)", func() C.int {
		return C.LGBM_DatasetSetField(h, field, unsafe.Pointer(&label[0]), C.int(len(label)), dtypeFloat32)
	})
	runtime.KeepAlive(label)
	if err != nil || len(names) == 0 {
		return err
	}
	cnames, freeNames := cStrings(names)
	defer freeNames()
	return call("DatasetSetFeatureNames", func() C.int {
		return C.LGBM_DatasetSetFeatureNames(h, cnames, C.int(len(names)))
	})
}

// Rows returns the number of rows.
func (d *Dataset) Rows() int { return d.rows }

// Cols returns the number of columns.
func (d *Dataset) Cols() int { return d.cols }

// Close frees the dataset. The memory stays until each Booster trained on it is closed too.
func (d *Dataset) Close() {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.inner == nil {
		return
	}
	d.cleanup.Stop()
	d.inner.release()
	d.inner = nil
}

// handle returns the live inner handle with one more reference, or ErrClosed.
func (d *Dataset) handle() (*datasetHandle, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.inner == nil {
		return nil, ErrClosed
	}
	d.inner.retain()
	return d.inner, nil
}

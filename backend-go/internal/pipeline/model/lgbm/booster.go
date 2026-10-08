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

// boosterHandle owns the C booster and the reference to its training data.
type boosterHandle struct {
	h     C.BoosterHandle
	train *datasetHandle
}

func (b *boosterHandle) free() {
	C.LGBM_BoosterFree(b.h)
	if b.train != nil {
		b.train.release()
	}
}

// Booster is a LightGBM model. Call Close when it is no longer needed.
// A finalizer frees it if Close is not called. The methods are safe for concurrent use.
type Booster struct {
	mu      sync.RWMutex
	inner   *boosterHandle
	cleanup runtime.Cleanup
}

func newBooster(inner *boosterHandle) *Booster {
	b := &Booster{inner: inner}
	b.cleanup = runtime.AddCleanup(b, (*boosterHandle).free, inner)
	return b
}

// Train creates a booster on ds with params and runs rounds boosting iterations.
// It stops early only when LightGBM reports that no further split is possible.
func Train(ds *Dataset, params string, rounds int) (*Booster, error) {
	train, err := ds.handle()
	if err != nil {
		return nil, err
	}
	cparams, free := cString(params)
	defer free()
	var h C.BoosterHandle
	if err := call("BoosterCreate", func() C.int { return C.LGBM_BoosterCreate(train.h, cparams, &h) }); err != nil {
		train.release()
		return nil, err
	}
	b := newBooster(&boosterHandle{h: h, train: train})
	for range rounds {
		var finished C.int
		if err := call("BoosterUpdateOneIter", func() C.int { return C.LGBM_BoosterUpdateOneIter(h, &finished) }); err != nil {
			b.Close()
			return nil, err
		}
		if finished != 0 {
			break
		}
	}
	return b, nil
}

// Load reads a booster from the text of Booster.Text or Python's model_to_string.
func Load(modelText string) (*Booster, error) {
	text, free := cString(modelText)
	defer free()
	var iterations C.int
	var h C.BoosterHandle
	if err := call("BoosterLoadModelFromString", func() C.int {
		return C.LGBM_BoosterLoadModelFromString(text, &iterations, &h)
	}); err != nil {
		return nil, err
	}
	return newBooster(&boosterHandle{h: h}), nil
}

// Close frees the booster. A second call does nothing.
func (b *Booster) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.inner == nil {
		return
	}
	b.cleanup.Stop()
	b.inner.free()
	b.inner = nil
}

// with runs f with the live C handle under the read lock.
func (b *Booster) with(f func(h C.BoosterHandle) error) error {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.inner == nil {
		return ErrClosed
	}
	return f(b.inner.h)
}

// NumFeature returns the number of input columns of the model.
func (b *Booster) NumFeature() (int, error) {
	var n C.int
	err := b.with(func(h C.BoosterHandle) error {
		return call("BoosterGetNumFeature", func() C.int { return C.LGBM_BoosterGetNumFeature(h, &n) })
	})
	return int(n), err
}

// Iterations returns the number of boosting iterations in the model.
func (b *Booster) Iterations() (int, error) {
	var n C.int
	err := b.with(func(h C.BoosterHandle) error {
		return call("BoosterGetCurrentIteration", func() C.int { return C.LGBM_BoosterGetCurrentIteration(h, &n) })
	})
	return int(n), err
}

// FeatureNames returns the input column names in the order that Predict expects.
func (b *Booster) FeatureNames() ([]string, error) {
	n, err := b.NumFeature()
	if err != nil {
		return nil, err
	}
	names, need, err := b.featureNames(n, featureNameBytes)
	if err == nil && need > featureNameBytes {
		names, _, err = b.featureNames(n, need)
	}
	return names, err
}

func (b *Booster) featureNames(n, size int) ([]string, int, error) {
	buffers := make([]*C.char, n)
	for i := range buffers {
		buffers[i] = (*C.char)(C.malloc(C.size_t(size)))
	}
	defer func() {
		for _, p := range buffers {
			C.free(unsafe.Pointer(p))
		}
	}()
	array := (**C.char)(C.malloc(C.size_t(max(n, 1)) * C.size_t(unsafe.Sizeof(uintptr(0)))))
	defer C.free(unsafe.Pointer(array))
	copy(unsafe.Slice(array, n), buffers)
	var got C.int
	var need C.size_t
	err := b.with(func(h C.BoosterHandle) error {
		return call("BoosterGetFeatureNames", func() C.int {
			return C.LGBM_BoosterGetFeatureNames(h, C.int(n), &got, C.size_t(size), &need, array)
		})
	})
	if err != nil {
		return nil, 0, err
	}
	if int(need) > size {
		return nil, int(need), nil
	}
	names := make([]string, int(got))
	for i := range names {
		names[i] = C.GoString(buffers[i])
	}
	return names, int(need), nil
}

// GainImportance returns the total gain of the splits on each feature, over all iterations.
func (b *Booster) GainImportance() ([]float64, error) {
	n, err := b.NumFeature()
	if err != nil {
		return nil, err
	}
	out := make([]float64, n)
	if n == 0 {
		return out, nil
	}
	err = b.with(func(h C.BoosterHandle) error {
		return call("BoosterFeatureImportance", func() C.int {
			return C.LGBM_BoosterFeatureImportance(h, 0, importanceGain, (*C.double)(unsafe.Pointer(&out[0])))
		})
	})
	return out, err
}

// Text returns the model as text, with all iterations and split importance, as Python's model_to_string.
func (b *Booster) Text() (string, error) {
	var text string
	err := b.with(func(h C.BoosterHandle) error {
		var need C.int64_t
		if err := call("BoosterSaveModelToString", func() C.int {
			return C.LGBM_BoosterSaveModelToString(h, firstIteration, allIterations, importanceSplit, 0, &need, nil)
		}); err != nil {
			return err
		}
		buf := (*C.char)(C.malloc(C.size_t(need)))
		defer C.free(unsafe.Pointer(buf))
		var got C.int64_t
		if err := call("BoosterSaveModelToString", func() C.int {
			return C.LGBM_BoosterSaveModelToString(h, firstIteration, allIterations, importanceSplit, need, &got, buf)
		}); err != nil {
			return err
		}
		if got > need {
			return fmt.Errorf("lgbm: model text grew from %d to %d bytes", need, got)
		}
		text = C.GoStringN(buf, C.int(got-1))
		return nil
	})
	return text, err
}

// Predict returns the probability of each row of a row-major nrow x ncol matrix. NaN is a missing value.
// threads <= 0 lets LightGBM choose the number of threads.
func Predict[T Float](b *Booster, x []T, nrow, ncol, threads int) ([]float64, error) {
	if err := checkShape(len(x), nrow, ncol); err != nil {
		return nil, err
	}
	if err := b.checkSingleOutput(); err != nil {
		return nil, err
	}
	out := make([]float64, nrow)
	if nrow == 0 {
		return out, nil
	}
	param := ""
	if threads > 0 {
		param = fmt.Sprintf("num_threads=%d", threads)
	}
	cparam, free := cString(param)
	defer free()
	var got C.int64_t
	err := b.with(func(h C.BoosterHandle) error {
		return call("BoosterPredictForMat", func() C.int {
			return C.LGBM_BoosterPredictForMat(h, unsafe.Pointer(&x[0]), C.int(dtypeOf(x)),
				C.int32_t(nrow), C.int32_t(ncol), rowMajor, predictNormal, firstIteration, allIterations,
				cparam, &got, (*C.double)(unsafe.Pointer(&out[0])))
		})
	})
	runtime.KeepAlive(x)
	if err != nil {
		return nil, err
	}
	if int(got) != nrow {
		return nil, fmt.Errorf("lgbm: %d outputs for %d rows", got, nrow)
	}
	return out, nil
}

// checkSingleOutput makes sure that the model gives one value for each row.
// A multiclass model would write past the output buffer.
func (b *Booster) checkSingleOutput() error {
	var n C.int
	err := b.with(func(h C.BoosterHandle) error {
		return call("BoosterGetNumClasses", func() C.int { return C.LGBM_BoosterGetNumClasses(h, &n) })
	})
	if err == nil && n != 1 {
		err = fmt.Errorf("lgbm: model has %d classes; Predict supports one output", n)
	}
	return err
}

// Predict returns the probability of each row of a row-major float32 matrix, as Predict.
func (b *Booster) Predict(x []float32, nrow, ncol, threads int) ([]float64, error) {
	return Predict(b, x, nrow, ncol, threads)
}

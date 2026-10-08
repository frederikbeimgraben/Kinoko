// Package fn holds small generic functions for data pipelines.
// Use them to transform slices and sequences without mutation in the caller.
package fn

import (
	"cmp"
	"iter"
	"maps"
	"slices"
)

// Map applies f to each item and returns a new slice.
func Map[T, U any](items []T, f func(T) U) []U {
	out := make([]U, len(items))
	for i, item := range items {
		out[i] = f(item)
	}
	return out
}

// MapErr applies f to each item. It stops at the first error.
func MapErr[T, U any](items []T, f func(T) (U, error)) ([]U, error) {
	out := make([]U, 0, len(items))
	for _, item := range items {
		value, err := f(item)
		if err != nil {
			return nil, err
		}
		out = append(out, value)
	}
	return out, nil
}

// Filter returns the items for which keep is true.
func Filter[T any](items []T, keep func(T) bool) []T {
	return slices.Collect(FilterSeq(slices.Values(items), keep))
}

// FilterSeq returns a sequence of the values for which keep is true.
func FilterSeq[T any](seq iter.Seq[T], keep func(T) bool) iter.Seq[T] {
	return func(yield func(T) bool) {
		for value := range seq {
			if keep(value) && !yield(value) {
				return
			}
		}
	}
}

// MapSeq returns a sequence that applies f to each value.
func MapSeq[T, U any](seq iter.Seq[T], f func(T) U) iter.Seq[U] {
	return func(yield func(U) bool) {
		for value := range seq {
			if !yield(f(value)) {
				return
			}
		}
	}
}

// Reduce folds the items into one value, from left to right.
func Reduce[T, A any](items []T, start A, f func(A, T) A) A {
	acc := start
	for _, item := range items {
		acc = f(acc, item)
	}
	return acc
}

// FlatMap applies f to each item and joins the results.
func FlatMap[T, U any](items []T, f func(T) []U) []U {
	out := make([]U, 0, len(items))
	for _, item := range items {
		out = append(out, f(item)...)
	}
	return out
}

// KeyBy returns a map from key(item) to item. A later item wins.
func KeyBy[T any, K comparable](items []T, key func(T) K) map[K]T {
	out := make(map[K]T, len(items))
	for _, item := range items {
		out[key(item)] = item
	}
	return out
}

// ToMap returns a map of the key and value that entry gives for each item.
// A later item wins.
func ToMap[T any, K comparable, V any](items []T, entry func(T) (K, V)) map[K]V {
	out := make(map[K]V, len(items))
	for _, item := range items {
		key, value := entry(item)
		out[key] = value
	}
	return out
}

// Unique returns the first of each value, in input order. The result is never nil.
func Unique[T comparable](items []T) []T {
	seen := make(map[T]struct{}, len(items))
	out := make([]T, 0, len(items))
	for _, item := range items {
		if _, ok := seen[item]; !ok {
			seen[item] = struct{}{}
			out = append(out, item)
		}
	}
	return out
}

// GroupBy returns a map from key(item) to the items with that key, in input order.
func GroupBy[T any, K comparable](items []T, key func(T) K) map[K][]T {
	out := make(map[K][]T)
	for _, item := range items {
		k := key(item)
		out[k] = append(out[k], item)
	}
	return out
}

// Set returns the distinct values of items as a set.
func Set[T comparable](items []T) map[T]struct{} {
	out := make(map[T]struct{}, len(items))
	for _, item := range items {
		out[item] = struct{}{}
	}
	return out
}

// SortedKeys returns the keys of m in ascending order.
func SortedKeys[K cmp.Ordered, V any](m map[K]V) []K {
	return slices.Sorted(maps.Keys(m))
}

// SortedBy returns a sorted copy of items. The sort is stable.
func SortedBy[T any, K cmp.Ordered](items []T, key func(T) K) []T {
	out := slices.Clone(items)
	slices.SortStableFunc(out, func(a, b T) int { return cmp.Compare(key(a), key(b)) })
	return out
}

// Find returns the first item for which match is true.
func Find[T any](items []T, match func(T) bool) (T, bool) {
	for _, item := range items {
		if match(item) {
			return item, true
		}
	}
	var zero T
	return zero, false
}

// Any tells if one item or more satisfies match.
func Any[T any](items []T, match func(T) bool) bool {
	return slices.ContainsFunc(items, match)
}

// All tells if each item satisfies match.
func All[T any](items []T, match func(T) bool) bool {
	return !slices.ContainsFunc(items, func(item T) bool { return !match(item) })
}

// Ptr returns a pointer to a copy of value.
func Ptr[T any](value T) *T {
	return &value
}

// Deref returns *p, or fallback when p is nil.
func Deref[T any](p *T, fallback T) T {
	if p == nil {
		return fallback
	}
	return *p
}

// Zip returns pairs of items at the same index. It stops at the shorter slice.
func Zip[A, B any](a []A, b []B) []Pair[A, B] {
	n := min(len(a), len(b))
	out := make([]Pair[A, B], n)
	for i := range n {
		out[i] = Pair[A, B]{a[i], b[i]}
	}
	return out
}

// Pair holds two values.
type Pair[A, B any] struct {
	First  A
	Second B
}

// Enumerate returns pairs of index and item.
func Enumerate[T any](items []T) []Pair[int, T] {
	out := make([]Pair[int, T], len(items))
	for i, item := range items {
		out[i] = Pair[int, T]{i, item}
	}
	return out
}

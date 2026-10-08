//go:build !linux && !darwin

package sources

import "math"

// freeBytes gives no limit where the service cannot read the file system.
func freeBytes(string) (uint64, error) { return math.MaxUint64, nil }

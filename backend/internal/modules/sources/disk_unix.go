//go:build linux || darwin

package sources

import "syscall"

// freeBytes gives the free bytes of the file system that holds path, for
// a process without root rights.
func freeBytes(path string) (uint64, error) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return 0, err
	}
	return uint64(st.Bavail) * uint64(st.Bsize), nil
}

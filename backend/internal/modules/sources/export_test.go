package sources

import "github.com/frederikbeimgraben/kinoko/backend/internal/core/web"

// SetFree replaces the free disk space function.
func (m *Module) SetFree(free func(string) (uint64, error)) { m.free = free }

// Abs gives the absolute path of a path under the data root.
func (m *Module) Abs(rel string) string { return m.files.abs(rel) }

// Restarted gives a new module on the same database and folders, as after
// a process restart.
func Restarted(m *Module) *Module {
	out := New(m.deps, m.runs)
	out.free = m.free
	return out
}

// AppendHandler gives the handler of appendDataSourceUpload.
func (m *Module) AppendHandler() web.Handler { return m.appendUpload }

// CompleteHandler gives the handler of completeDataSourceUpload.
func (m *Module) CompleteHandler() web.Handler { return m.completeUpload }

// NeedDisk is needDisk.
var NeedDisk = needDisk

// UseTreesGridRows sets the row limits of the built-in trees-grid check.
func (m *Module) UseTreesGridRows(lo, hi int64) {
	m.builtins[KindTreesGrid] = treesGrid{minRows: lo, maxRows: hi}
}

// UseProcessor sets the processor of a kind for this module only.
// UseProcessor replaces the processor of a kind for this module. A nil
// processor makes the kind act as a kind without a processor.
func (m *Module) UseProcessor(kind Kind, p Processor) { m.overrides[kind] = p }

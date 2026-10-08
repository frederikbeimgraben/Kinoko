package catalog

// Builds gives the count of bundle builds since the last reset.
func (m *Module) Builds() int64 { return m.cache.builds.Load() }

// ForgetBundle drops the built bundle and resets the count of builds.
func (m *Module) ForgetBundle() { m.cache.forget() }

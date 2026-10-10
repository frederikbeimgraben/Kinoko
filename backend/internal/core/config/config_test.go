package config

import "testing"

func TestLabelRemovesTheCommitHash(t *testing.T) {
	cases := map[string]string{
		"v2026-10-08-01-3-g65dd41a": "v2026-10-08-01-3",
		"v2026-10-09+65dd41a":       "v2026-10-09+65dd41a",
		"v2026-10-08-01":            "v2026-10-08-01",
		"2026-10-08-01":             "v2026-10-08-01",
		"2026-10-08-01-3-g65dd41a":  "v2026-10-08-01-3",
		"5896dc4":                   "5896dc4",
		" ":                         "dev",
		"":                          "dev",
	}
	for raw, want := range cases {
		if got := Label(raw); got != want {
			t.Errorf("Label(%q) = %q, want %q", raw, got, want)
		}
	}
}

func TestVersionUsesTheStampOfTheLinker(t *testing.T) {
	saved := build
	t.Cleanup(func() { build = saved })
	build = ""
	if Version() != "dev" {
		t.Fatal(Version())
	}
	build = "v2026-10-08-01-3-g65dd41a"
	if Version() != "v2026-10-08-01-3" {
		t.Fatal(Version())
	}
}

func lookupOf(values map[string]string) Lookup {
	return func(name string) (string, bool) {
		value, ok := values[name]
		return value, ok
	}
}

func TestProviderNameFromIssuerHost(t *testing.T) {
	s, err := FromLookup(lookupOf(map[string]string{"PILZE_OIDC_ISSUER": "https://login.example.org/application/o/pilze"}))
	if err != nil {
		t.Fatal(err)
	}
	if s.OIDCIssuer != "https://login.example.org/application/o/pilze/" || s.ProviderName() != "login.example.org" {
		t.Fatal(s.OIDCIssuer, s.ProviderName())
	}
}

func TestProviderNameFromSetting(t *testing.T) {
	s, err := FromLookup(lookupOf(map[string]string{
		"PILZE_OIDC_ISSUER": "https://login.example.org/", "PILZE_OIDC_NAME": "Example ID",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if s.ProviderName() != "Example ID" {
		t.Fatal(s.ProviderName())
	}
}

func TestNoIssuerByDefault(t *testing.T) {
	s, err := FromLookup(lookupOf(map[string]string{}))
	if err != nil {
		t.Fatal(err)
	}
	if s.OIDCIssuer != "" || s.ProviderName() != "" {
		t.Fatal(s.OIDCIssuer, s.ProviderName())
	}
}

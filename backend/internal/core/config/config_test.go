package config

import "testing"

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

// Package config reads the settings of the service from the environment.
// Each variable has the prefix PILZE_. A file .env in the work directory
// gives values for variables that the environment does not set.
package config

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Version is the version of the service.
const Version = "3.0.0"

// Settings are the values that the service reads at start.
type Settings struct {
	DB             string
	Photos         string
	Maps           string
	OIDCIssuer     string
	OIDCClientID   string
	Origin         string
	AdminGroup     string
	InternalToken  string
	MaxPhotoBytes  int64
	Listen         string
	Chain          string
	RunLogs        string
	DataDir        string
	DataRoot       string
	PipelineEnable bool
	// Schedule is the weekly start of the fetch and render runs: "<Weekday> HH:MM <IANA zone>".
	Schedule string
}

// Defaults are the settings for local development.
func Defaults() Settings {
	return Settings{
		DB:             "./var/pilze.sqlite",
		Photos:         "./var/fotos",
		Maps:           "./var/maps",
		OIDCIssuer:     "https://sso.beimgraben.net/application/o/pilze/",
		OIDCClientID:   "pilze",
		Origin:         "http://localhost:4200",
		AdminGroup:     "pilze-admins",
		InternalToken:  "intern",
		MaxPhotoBytes:  12 * 1024 * 1024,
		Listen:         "127.0.0.1:8111",
		Chain:          "./var/modell",
		RunLogs:        "./var/runs",
		DataRoot:       "./var/daten",
		PipelineEnable: true,
		Schedule:       "Mon 03:30 Europe/Berlin",
	}
}

// Lookup returns the value of a variable, or false.
type Lookup func(name string) (string, bool)

// Load reads the settings from the environment and from the file .env.
func Load() (Settings, error) {
	file, err := readDotEnv(".env")
	if err != nil {
		return Settings{}, err
	}
	return FromLookup(chain(os.LookupEnv, file))
}

// FromLookup builds the settings from a lookup function.
func FromLookup(lookup Lookup) (Settings, error) {
	s := Defaults()
	text := func(name string, target *string) {
		if value, ok := lookup("PILZE_" + name); ok {
			*target = value
		}
	}
	text("DB", &s.DB)
	text("FOTOS", &s.Photos)
	text("MAPS", &s.Maps)
	text("OIDC_ISSUER", &s.OIDCIssuer)
	text("OIDC_CLIENT_ID", &s.OIDCClientID)
	text("ORIGIN", &s.Origin)
	text("ADMIN_GROUP", &s.AdminGroup)
	text("INTERNAL_TOKEN", &s.InternalToken)
	text("LISTEN", &s.Listen)
	text("CHAIN", &s.Chain)
	text("RUN_LOGS", &s.RunLogs)
	text("DATEN", &s.DataDir)
	text("DATA", &s.DataRoot)
	text("SCHEDULE", &s.Schedule)
	if value, ok := lookup("PILZE_MAX_PHOTO_BYTES"); ok {
		n, err := strconv.ParseInt(value, 10, 64)
		if err != nil || n <= 0 {
			return Settings{}, fmt.Errorf("PILZE_MAX_PHOTO_BYTES: %q is not a positive number", value)
		}
		s.MaxPhotoBytes = n
	}
	if value, ok := lookup("PILZE_PIPELINE"); ok {
		on, err := strconv.ParseBool(value)
		if err != nil {
			return Settings{}, fmt.Errorf("PILZE_PIPELINE: %q is not a boolean", value)
		}
		s.PipelineEnable = on
	}
	s.DB = DatabasePath(s.DB)
	s.OIDCIssuer = withSlash(s.OIDCIssuer)
	return s, nil
}

// DatabasePath accepts a file path or an SQLAlchemy URL of the Python service.
// The NixOS module of the Python service sets "sqlite+aiosqlite:////var/lib/x.sqlite".
func DatabasePath(value string) string {
	for _, prefix := range []string{"sqlite+aiosqlite:///", "sqlite:///"} {
		if rest, ok := strings.CutPrefix(value, prefix); ok {
			return rest
		}
	}
	return value
}

// DiscoveryURL is the address of the OpenID configuration document.
func (s Settings) DiscoveryURL() string {
	return s.OIDCIssuer + ".well-known/openid-configuration"
}

// JWKSURL is the address of the signing keys when discovery gives none.
func (s Settings) JWKSURL() string {
	return s.OIDCIssuer + "jwks/"
}

func withSlash(value string) string {
	if strings.HasSuffix(value, "/") {
		return value
	}
	return value + "/"
}

func chain(lookups ...Lookup) Lookup {
	return func(name string) (string, bool) {
		for _, lookup := range lookups {
			if value, ok := lookup(name); ok {
				return value, true
			}
		}
		return "", false
	}
}

func readDotEnv(path string) (Lookup, error) {
	file, err := os.Open(path)
	if os.IsNotExist(err) {
		return func(string) (string, bool) { return "", false }, nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()
	values := map[string]string{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		name, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		values[strings.TrimSpace(name)] = strings.Trim(strings.TrimSpace(value), `"'`)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return func(name string) (string, bool) {
		value, ok := values[name]
		return value, ok
	}, nil
}

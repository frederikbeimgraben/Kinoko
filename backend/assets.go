// Package backend holds the files that the service embeds: the API contract
// and the seed data.
package backend

import "embed"

// Contract is the OpenAPI document of the service.
//
//go:embed openapi.yaml
var Contract []byte

// Data holds the seed data under daten/.
//
//go:embed daten
var Data embed.FS

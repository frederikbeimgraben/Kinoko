// Command commonsfotos finds freely licensed lead photos for the species on
// Wikimedia Commons and writes the seed file daten/fotos.json.
//
// Step 1 queries Commons for each species file and writes the
// candidates:
//
//	go run ./tools/commonsfotos find -arten daten/arten -out candidates.json
//
// Step 2 adds the English common names of Wikidata to the candidates:
//
//	go run ./tools/commonsfotos names -arten daten/arten -candidates candidates.json
//
// Step 3 picks one candidate for each species and writes the seed file. A
// picks file can name the file for a species ({"steinpilz": "File:…jpg"}) or
// leave a species out ({"steinpilz": ""}). Without an entry the candidate
// with the highest score wins:
//
//	go run ./tools/commonsfotos pick -arten daten/arten -candidates candidates.json \
//	    -picks picks.json -out daten/fotos.json
//
// The tool sends the User-Agent of the project, waits between requests and
// waits longer after the answer 429.
package main

import (
	"fmt"
	"os"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		_, _ = fmt.Fprintln(os.Stderr, "commonsfotos:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("use find, names or pick")
	}
	switch args[0] {
	case "find":
		return runFind(args[1:])
	case "names":
		return runNames(args[1:])
	case "pick":
		return runPick(args[1:])
	default:
		return fmt.Errorf("unknown command %q; use find, names or pick", args[0])
	}
}

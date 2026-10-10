// Command commonsfotos finds freely licensed lead photos for the species on
// Wikimedia Commons and writes the seed file daten/fotos.json. It has three steps:
// find, names and pick. README.md in this folder tells how to run them.
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

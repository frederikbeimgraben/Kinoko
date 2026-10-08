package occ

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strconv"
)

// slimLine holds the keys of a slim record that BuildOccurrences reads.
type slimLine struct {
	GBIFID    flexString `json:"gbifID"`
	Species   flexString `json:"species"`
	Class     flexString `json:"class"`
	Lat       flexFloat  `json:"decimalLatitude"`
	Lon       flexFloat  `json:"decimalLongitude"`
	Unc       flexFloat  `json:"coordinateUncertaintyInMeters"`
	EventDate flexString `json:"eventDate"`
	Day       flexString `json:"day"`
	Observer  flexString `json:"recordedByHash"`
}

// flexString reads a JSON string or number. Null gives ok false.
type flexString struct {
	s  string
	ok bool
}

func (f *flexString) UnmarshalJSON(b []byte) error {
	b = bytes.TrimSpace(b)
	switch {
	case string(b) == "null":
		*f = flexString{}
	case len(b) > 0 && b[0] == '"':
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		*f = flexString{s, true}
	default:
		*f = flexString{string(b), true}
	}
	return nil
}

// flexFloat reads a JSON number or a numeric string. Null or another value gives NaN.
type flexFloat struct {
	v   float64
	set bool
}

func (f *flexFloat) UnmarshalJSON(b []byte) error {
	s := string(bytes.Trim(bytes.TrimSpace(b), `"`))
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		v = math.NaN()
	}
	*f = flexFloat{v, true}
	return nil
}

func (f flexFloat) value() float64 {
	if !f.set {
		return math.NaN()
	}
	return f.v
}

// readSlim calls fn for each line of a gzipped JSON-Lines file.
func readSlim(path string, fn func(slimLine)) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()
	gz, err := gzip.NewReader(bufio.NewReaderSize(f, 1<<16))
	if err != nil {
		return fmt.Errorf("occ: %s: %w", path, err)
	}
	defer func() { _ = gz.Close() }()
	sc := bufio.NewScanner(gz)
	sc.Buffer(make([]byte, 1<<16), 1<<26)
	for n := 1; sc.Scan(); n++ {
		line := bytes.TrimSpace(sc.Bytes())
		if len(line) == 0 {
			continue
		}
		var rec slimLine
		if err := json.Unmarshal(line, &rec); err != nil {
			return fmt.Errorf("occ: %s line %d: %w", path, n, err)
		}
		fn(rec)
	}
	if err := sc.Err(); err != nil {
		return fmt.Errorf("occ: %s: %w", path, err)
	}
	return nil
}

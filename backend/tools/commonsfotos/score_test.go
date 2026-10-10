package main

import "testing"

func TestParseLicence(t *testing.T) {
	cases := []struct {
		short, address string
		want           licence
	}{
		{"CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", licence{"cc_by_sa_3", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/"}},
		{"CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/deed.de", licence{"cc_by_4", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"}},
		{"CC BY-SA 2.5", "http://creativecommons.org/licenses/by-sa/2.5/", licence{"cc_by_sa_2_5", "CC BY-SA 2.5", "https://creativecommons.org/licenses/by-sa/2.5/"}},
		{"CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", licence{"cc0", "CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/"}},
		{"Public domain", "", licence{"public_domain", "Public Domain", ""}},
		{"CC BY-SA 3.0 de", "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en", licence{}},
		{"CC BY-NC 4.0", "https://creativecommons.org/licenses/by-nc/4.0", licence{}},
		{"GFDL", "https://www.gnu.org/copyleft/fdl.html", licence{}},
	}
	for _, c := range cases {
		if got := parseLicence(c.short, c.address); got != c.want {
			t.Errorf("%s: got %+v, want %+v", c.short, got, c.want)
		}
	}
}

func TestPlainText(t *testing.T) {
	got := plainText(`<a href="//commons.wikimedia.org/wiki/User:X">Holger&nbsp;Krisp</a>  <span>(talk)</span>`)
	if got != "Holger Krisp (talk)" {
		t.Fatalf("%q", got)
	}
}

func TestScorePrefersAFieldPhotoOfTheSpecies(t *testing.T) {
	latin := []string{"Boletus edulis"}
	field := candidate{
		Title: "File:Boletus edulis 2020 G1.jpg", Mime: "image/jpeg", Width: 3000, Height: 2000,
		Author: "A", Licence: licence{Code: "cc_by_sa_4"}, Assessments: "quality",
		Categories: "Boletus edulis|Quality images",
	}
	spores := field
	spores.Title = "File:Boletus edulis spores 1000x.jpg"
	basket := field
	basket.Title = "File:Edible fungi in basket.jpg"
	closed := field
	closed.Licence = licence{}
	fieldScore, _ := score(field, latin)
	for _, other := range []candidate{spores, basket, closed} {
		if otherScore, notes := score(other, latin); otherScore >= 0 || otherScore >= fieldScore {
			t.Errorf("%s: %d %v, want below 0 and below %d", other.Title, otherScore, notes, fieldScore)
		}
	}
	if fieldScore <= 0 {
		t.Fatal(fieldScore)
	}
}

func TestCleanAuthor(t *testing.T) {
	cases := map[string]string{
		"This image was created by user Dan Molter (shroomydan) at Mushroom Observer , a source for mycological images.": "Dan Molter (shroomydan), Mushroom Observer",
		"voir ci-dessous / see below": "",
		"Holger Krisp":                "Holger Krisp",
	}
	for in, want := range cases {
		if got := cleanAuthor(in); got != want {
			t.Errorf("%q: got %q, want %q", in, got, want)
		}
	}
}

func TestWithoutTracking(t *testing.T) {
	got := withoutTracking("https://upload.wikimedia.org/a/b.jpg?utm_source=commons.wikimedia.org&utm_content=original")
	if got != "https://upload.wikimedia.org/a/b.jpg" {
		t.Fatal(got)
	}
}

func TestBestEnglish(t *testing.T) {
	list := []vernacular{
		{Name: "King Bolete", Language: "eng", Source: "Checklist of Vermont Fungi", Preferred: true},
		{Name: "Cep", Language: "eng", Source: "United Kingdom Species Inventory (UKSI)"},
		{Name: "Penny Bun", Language: "eng", Source: "United Kingdom Species Inventory (UKSI)", Preferred: true},
		{Name: "Steinpilz", Language: "deu", Source: "United Kingdom Species Inventory (UKSI)", Preferred: true},
	}
	if got := bestEnglish(list); got != "Penny bun" {
		t.Fatal(got)
	}
	if got := bestEnglish(list[:1]); got != "" {
		t.Fatal(got)
	}
}

func TestSentenceCase(t *testing.T) {
	cases := map[string]string{
		"Penny Bun":            "Penny bun",
		"St George's Mushroom": "St George's mushroom",
		"Slippery Jack":        "Slippery jack",
		"Oyster mushroom":      "Oyster mushroom",
	}
	for in, want := range cases {
		if got := sentenceCase(in); got != want {
			t.Errorf("%q: got %q, want %q", in, got, want)
		}
	}
}

func TestChooseSkipsAUsedFile(t *testing.T) {
	good := func(title string) candidate {
		return candidate{Title: title, Author: "A", Licence: licence{Code: "cc0"}, Score: 10}
	}
	result := found{Candidates: []candidate{good("File:A.jpg"), good("File:B.jpg")}}
	chosen, ok := choose(result, map[string]string{}, "art", map[string]bool{"File:A.jpg": true})
	if !ok || chosen.Title != "File:B.jpg" {
		t.Fatal(chosen, ok)
	}
	if _, ok := choose(result, map[string]string{"art": ""}, "art", map[string]bool{}); ok {
		t.Fatal("an empty pick must leave the species out")
	}
}

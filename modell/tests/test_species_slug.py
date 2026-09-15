"""The catalogue lookup: matching a chain's Latin names to a species slug."""

from __future__ import annotations

from species_slug import matching_slug

SPECIES = [
    {"slug": "boletus-edulis", "scientificName": "Boletus edulis"},
    {"slug": "cantharellus-cibarius", "scientificName": "Cantharellus cibarius"},
]


def test_matching_slug_finds_the_species_by_its_latin_name() -> None:
    assert matching_slug("Boletus edulis", SPECIES) == "boletus-edulis"


def test_matching_slug_matches_case_insensitively() -> None:
    assert matching_slug("boletus EDULIS", SPECIES) == "boletus-edulis"


def test_matching_slug_matches_any_of_several_comma_separated_names() -> None:
    taxa = "Lactarius deliciosus,Cantharellus cibarius"
    assert matching_slug(taxa, SPECIES) == "cantharellus-cibarius"


def test_matching_slug_without_a_match_is_none() -> None:
    assert matching_slug("Amanita phalloides", SPECIES) is None

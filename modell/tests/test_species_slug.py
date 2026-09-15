"""Katalog-Zuordnung: einmal je Lauf holen, dann Latein gegen Slug matchen."""

from __future__ import annotations

import json
from collections.abc import Callable

import httpx
import pytest
import species_slug as sut

SPECIES = [
    {"slug": "boletus-edulis", "scientificName": "Boletus edulis"},
    {"slug": "cantharellus-cibarius", "scientificName": "Cantharellus cibarius"},
]
CATALOG = sut.latin_to_slug(SPECIES)
REAL_CLIENT = httpx.Client


def test_latin_to_slug_builds_the_mapping() -> None:
    assert sut.latin_to_slug(SPECIES) == {
        "boletus edulis": "boletus-edulis",
        "cantharellus cibarius": "cantharellus-cibarius",
    }


def test_matching_slug_finds_the_species_by_its_latin_name() -> None:
    assert sut.matching_slug("Boletus edulis", CATALOG) == "boletus-edulis"


def test_matching_slug_matches_case_insensitively() -> None:
    assert sut.matching_slug("boletus EDULIS", CATALOG) == "boletus-edulis"


def test_matching_slug_matches_any_of_several_comma_separated_names() -> None:
    taxa = "Lactarius deliciosus,Cantharellus cibarius"
    assert sut.matching_slug(taxa, CATALOG) == "cantharellus-cibarius"


def test_matching_slug_without_a_match_is_none() -> None:
    assert sut.matching_slug("Amanita phalloides", CATALOG) is None


def test_read_catalog_without_the_variable_aborts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(sut.CATALOG_ENV, raising=False)
    with pytest.raises(SystemExit):
        sut.read_catalog()


def test_main_match_without_a_catalogue_hit_returns_one(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(sut.CATALOG_ENV, json.dumps(CATALOG))
    assert sut.main(["--match", "Amanita phalloides"]) == 1


def test_main_match_with_a_hit_prints_the_slug(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv(sut.CATALOG_ENV, json.dumps(CATALOG))
    assert sut.main(["--match", "Boletus edulis"]) == 0
    assert capsys.readouterr().out.strip() == "boletus-edulis"


def mock_client(
    handle: Callable[[httpx.Request], httpx.Response],
) -> Callable[..., httpx.Client]:
    """Ersetzt den Klienten des Moduls durch einen mit fester Antwort."""

    def build(*, base_url: str, timeout: float) -> httpx.Client:
        return REAL_CLIENT(transport=httpx.MockTransport(handle), base_url=base_url, timeout=timeout)

    return build


def test_main_fetch_aborts_when_the_catalogue_is_unreachable(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    def broken(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("kein Netz", request=request)

    monkeypatch.setattr(sut.httpx, "Client", mock_client(broken))
    assert sut.main(["--fetch"]) == 1
    assert "nicht erreichbar" in capsys.readouterr().err


def test_main_fetch_prints_the_catalogue_as_json(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        del request
        return httpx.Response(200, json={"items": SPECIES, "nextCursor": None})

    monkeypatch.setattr(sut.httpx, "Client", mock_client(handle))
    assert sut.main(["--fetch"]) == 0
    assert json.loads(capsys.readouterr().out) == CATALOG

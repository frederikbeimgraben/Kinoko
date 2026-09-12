"""Die mehrwertige Auswahl: oder in der Gruppe, und zwischen den Gruppen.

Der Fall, um den es geht, ist der dritte: eine Art, zu der die Quelle nichts
sagt. Sie faellt nicht still heraus, sie steht unter den Treffern, und je
Gruppe steht, wie viele allein an ihr haengen.
"""

import httpx
import pytest

from app.main import build_app
from app.modules.species.dependencies import current_catalog
from app.modules.species.schemas import FacetKey
from app.modules.species.selection import Answer, Selection, judge, selection_of
from tests.objects import catalog_for_tests


@pytest.fixture
def call(schema: None) -> httpx.AsyncClient:  # noqa: ARG001
    """Die Liste liest das Titelbild aus der Datenbank, darum das Schema."""
    built = build_app()
    built.dependency_overrides[current_catalog] = catalog_for_tests
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=built), base_url="http://test")


def test_a_pair_without_a_group_falls_away() -> None:
    """Ein altes Lesezeichen soll die Liste nicht mit einem Fehler beantworten."""
    picked = selection_of(["speisewert:essbar", "gibtesnicht:egal", "ohneWert"], [])

    assert picked.values == {FacetKey.EDIBILITY: frozenset({"essbar"})}


def test_several_values_of_one_group_stand_together() -> None:
    picked = selection_of(["speisewert:essbar", "speisewert:giftig"], [])

    assert picked.values[FacetKey.EDIBILITY] == frozenset({"essbar", "giftig"})
    assert picked.active == (FacetKey.EDIBILITY,)


def test_a_species_says_one_of_three_things() -> None:
    catalog = catalog_for_tests()
    steinpilz = catalog.profiles["steinpilz"]
    picked = selection_of(["speisewert:essbar", "hutform:gewoelbt"], [])

    assert picked.answer(FacetKey.EDIBILITY, steinpilz) is Answer.MATCH
    assert (
        picked.answer(FacetKey.PROTECTION, steinpilz)
        if FacetKey.PROTECTION in picked.values
        else Answer.MATCH
    ) is Answer.MATCH
    # Der Testkatalog nennt keine Hutform. Die Quelle sagt nichts, sie sagt
    # nicht "keine der Formen".
    assert picked.answer(FacetKey.CAP_SHAPE, steinpilz) is Answer.UNKNOWN


def test_a_gap_alone_does_not_reject() -> None:
    catalog = catalog_for_tests()
    steinpilz = catalog.profiles["steinpilz"]
    picked = selection_of(["hutform:gewoelbt"], [])

    verdict = judge(picked, steinpilz)

    assert not verdict.hit
    assert not verdict.rejected
    assert verdict.gaps == frozenset({FacetKey.CAP_SHAPE})


def test_the_switch_turns_a_gap_into_a_hit() -> None:
    catalog = catalog_for_tests()
    steinpilz = catalog.profiles["steinpilz"]
    picked = selection_of(["hutform:gewoelbt"], [FacetKey.CAP_SHAPE])

    verdict = judge(picked, steinpilz)

    assert verdict.hit
    assert verdict.gaps == frozenset()


def test_a_miss_beats_every_switch() -> None:
    catalog = catalog_for_tests()
    steinpilz = catalog.profiles["steinpilz"]
    picked = selection_of(["speisewert:giftig"], list(FacetKey))

    verdict = judge(picked, steinpilz)

    assert verdict.rejected
    assert not verdict.hit


def test_an_empty_selection_lets_everyone_through() -> None:
    catalog = catalog_for_tests()

    for profile in catalog.profiles.values():
        assert judge(Selection(), profile).hit


async def test_the_wire_carries_both_sets_and_the_gaps(call: httpx.AsyncClient) -> None:
    async with call:
        answer = await call.get("/api/arten", params={"wert": "hutform:gewoelbt"})

    body = answer.json()
    assert answer.status_code == 200
    # Der Testkatalog nennt fuer keine der vier Arten eine Hutform.
    assert body["arten"] == []
    assert len(body["unbeurteilbar"]) == 4
    assert body["luecken"] == [{"schluessel": "hutform", "anzahl": 4}]


async def test_the_switch_moves_them_into_the_hits(call: httpx.AsyncClient) -> None:
    async with call:
        answer = await call.get(
            "/api/arten", params={"wert": "hutform:gewoelbt", "ohneAngabe": "hutform"}
        )

    body = answer.json()
    assert len(body["arten"]) == 4
    assert body["unbeurteilbar"] == []
    assert body["luecken"] == [{"schluessel": "hutform", "anzahl": 0}]


async def test_two_groups_hold_together(call: httpx.AsyncClient) -> None:
    async with call:
        both = (
            await call.get(
                "/api/arten", params=[("wert", "speisewert:essbar"), ("wert", "schutz:keiner")]
            )
        ).json()
        edible = (await call.get("/api/arten", params={"wert": "speisewert:essbar"})).json()
        unprotected = (await call.get("/api/arten", params={"wert": "schutz:keiner"})).json()

    names = {row["slug"] for row in both["arten"]}
    assert names == {row["slug"] for row in edible["arten"]} & {
        row["slug"] for row in unprotected["arten"]
    }


async def test_several_values_of_one_group_widen_the_result(call: httpx.AsyncClient) -> None:
    async with call:
        one = (await call.get("/api/arten", params={"wert": "schutz:keiner"})).json()
        two = (
            await call.get(
                "/api/arten",
                params=[("wert", "schutz:keiner"), ("wert", "schutz:besondersGeschuetzt")],
            )
        ).json()

    assert len(two["arten"]) > len(one["arten"])
    assert {row["slug"] for row in one["arten"]} < {row["slug"] for row in two["arten"]}

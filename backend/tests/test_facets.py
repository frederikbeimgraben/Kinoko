"""Der Merkmalskatalog: Abdeckung je Gruppe, Zahl je Wert.

Zwei Dinge halten diese Tests fest. Die Zahl am Wert ist absolut ueber den
ganzen Katalog, nicht das Ergebnis nach der Wahl. Und eine Gruppe nennt ihre
Abdeckung auch dann, wenn keine einzige Art sie traegt.
"""

import httpx
import pytest

from app.main import build_app
from app.modules.species.catalog import DATA, Catalog, read_profiles
from app.modules.species.dependencies import current_catalog
from app.modules.species.facets import FACETS, facet_catalogue
from app.modules.species.schemas import FacetKey, FacetKind
from tests.objects import catalog_for_tests


@pytest.fixture
def call() -> httpx.AsyncClient:
    built = build_app()
    built.dependency_overrides[current_catalog] = catalog_for_tests
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=built), base_url="http://test")


def shipped() -> Catalog:
    """Der ausgelieferte Katalog. Die Abdeckung soll gegen ihn stimmen."""
    return catalog_for_tests()


def test_every_group_appears_once() -> None:
    keys = [facet.key for facet in FACETS]

    assert len(keys) == len(set(keys))
    assert set(keys) <= set(FacetKey)


def test_the_groups_stand_by_coverage_the_densest_first() -> None:
    groups = facet_catalogue(shipped()).groups

    assert [group.described for group in groups] == sorted(
        (group.described for group in groups), reverse=True
    )


def test_a_group_carries_either_values_or_parts() -> None:
    for group in facet_catalogue(shipped()).groups:
        assert not (group.values and group.parts)


def test_a_group_without_coverage_still_names_it_with_zero() -> None:
    """Der Testkatalog nennt kein Reagenz. Die Gruppe steht trotzdem, mit Null."""
    groups = {group.key: group for group in facet_catalogue(shipped()).groups}

    assert groups[FacetKey.REAGENTS].described == 0
    assert groups[FacetKey.REAGENTS].values == []


def test_the_count_of_a_value_is_the_number_of_species_it_hits() -> None:
    catalog = shipped()
    groups = {group.key: group for group in facet_catalogue(catalog).groups}

    edibility = {value.value: value.count for value in groups[FacetKey.EDIBILITY].values}
    expected: dict[str, int] = {}
    for profile in catalog.profiles.values():
        expected[str(profile.edibility)] = expected.get(str(profile.edibility), 0) + 1

    assert {value: count for value, count in edibility.items() if count} == expected


def test_a_value_that_no_species_carries_still_stands_with_zero() -> None:
    groups = {group.key: group for group in facet_catalogue(shipped()).groups}
    catalog = shipped()
    carried = {str(profile.edibility) for profile in catalog.profiles.values()}

    empty = [value for value in groups[FacetKey.EDIBILITY].values if value.value not in carried]

    assert all(value.count == 0 for value in empty)


def test_a_measurement_carries_its_bounds_and_its_unit() -> None:
    groups = {group.key: group for group in facet_catalogue(shipped()).groups}
    span = groups[FacetKey.MEASUREMENTS]

    assert span.kind is FacetKind.SPAN
    for part in span.parts:
        assert part.values == []
        if part.described:
            assert part.minimum is not None
            assert part.maximum is not None
            assert part.minimum <= part.maximum
            assert part.unit in {"cm", "um"}


def test_the_coverage_of_the_shipped_catalogue_is_what_the_profiles_say() -> None:
    """Die Abdeckung wird gezaehlt, nicht behauptet."""
    profiles = read_profiles(DATA / "arten")
    catalog = shipped()
    groups = {group.key: group for group in facet_catalogue(catalog).groups}

    assert groups[FacetKey.EDIBILITY].described == len(catalog.profiles)
    assert groups[FacetKey.CAP_SHAPE].described == sum(
        1 for profile in catalog.profiles.values() if profile.cap_shape is not None
    )
    # Der ausgelieferte Bestand ist der Massstab: 94 der 306 Profile nennen
    # einen Umriss. Faellt die Zahl, hat jemand Angaben verloren.
    assert sum(1 for profile in profiles.values() if profile.cap_shape is not None) == 94
    assert len(profiles) == 306


def test_a_period_counts_every_month_it_runs_through() -> None:
    catalog = shipped()
    groups = {group.key: group for group in facet_catalogue(catalog).groups}
    period = groups[FacetKey.PERIOD]

    assert period.kind is FacetKind.PERIOD
    assert [value.value for value in period.values] == [str(month) for month in range(1, 13)]
    assert period.described == sum(
        1 for profile in catalog.profiles.values() if profile.period is not None
    )


async def test_the_endpoint_answers_before_the_slug_takes_the_path(
    call: httpx.AsyncClient,
) -> None:
    async with call:
        answer = await call.get("/api/arten/merkmale")

    assert answer.status_code == 200
    body = answer.json()
    assert body["arten"] == 4
    assert {group["schluessel"] for group in body["gruppen"]} == {key.value for key in FacetKey}
    first = body["gruppen"][0]
    assert set(first) == {"schluessel", "art", "beschrieben", "werte", "teile"}


async def test_the_wire_names_stay_german(call: httpx.AsyncClient) -> None:
    async with call:
        body = (await call.get("/api/arten/merkmale")).json()

    edibility = next(g for g in body["gruppen"] if g["schluessel"] == "speisewert")

    assert edibility["art"] == "werte"
    assert set(edibility["werte"][0]) == {"wert", "anzahl"}

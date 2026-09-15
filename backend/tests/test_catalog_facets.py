"""Tests des FacetService: belegte Werte und Abgleich je Art."""

from __future__ import annotations

import uuid

from app.modules.catalog.facets import FacetService, Selection, SpeciesFacets
from app.shared.enums import BodyPart, CapShape, Dimension, Edibility, HymeniumType

SERVICE = FacetService()


def make(
    edibility: Edibility = Edibility.EDIBLE,
    hymenium: HymeniumType | None = HymeniumType.TUBES,
    cap_shapes: frozenset[CapShape] = frozenset({CapShape.CONVEX}),
    colours: dict[BodyPart, frozenset[str]] | None = None,
    measurements: dict[tuple[BodyPart, Dimension], tuple[float, float]] | None = None,
    period: tuple[int, int] | None = (6, 10),
    term_ids: frozenset[uuid.UUID] = frozenset(),
) -> SpeciesFacets:
    return SpeciesFacets(
        species_id=uuid.uuid4(),
        edibility=edibility,
        hymenium=hymenium,
        cap_shapes=cap_shapes,
        colours={BodyPart.CAP: frozenset({"brown"})} if colours is None else colours,
        measurements=(
            {(BodyPart.CAP, Dimension.WIDTH): (4.0, 12.0)} if measurements is None else measurements
        ),
        period=period,
        term_ids=term_ids,
    )


def test_catalogue_counts_every_value() -> None:
    a = make(edibility=Edibility.EDIBLE, period=(6, 8))
    b = make(edibility=Edibility.POISONOUS, hymenium=None, period=(11, 2))
    out = SERVICE.catalogue([a, b])
    assert out["edibility"] == {"edible": 1, "poisonous": 1}
    assert out["hymenium"] == {"tubes": 1}
    assert out["colour.cap"] == {"brown": 2}
    assert out["period"]["7"] == 1
    assert out["period"]["12"] == 1
    assert out["period"]["1"] == 1
    assert "3" not in out["period"]
    assert out["unknown"]["hymenium"] == 1


def test_match_empty_selection_matches_everything() -> None:
    assert SERVICE.match(make(), Selection())


def test_match_edibility_axis() -> None:
    species = make(edibility=Edibility.EDIBLE)
    assert SERVICE.match(species, Selection(edibility=frozenset({Edibility.EDIBLE})))
    assert not SERVICE.match(species, Selection(edibility=frozenset({Edibility.POISONOUS})))


def test_match_hymenium_axis() -> None:
    species = make(hymenium=HymeniumType.TUBES)
    assert SERVICE.match(species, Selection(hymenium=frozenset({HymeniumType.TUBES})))
    assert not SERVICE.match(species, Selection(hymenium=frozenset({HymeniumType.GILLS})))


def test_match_hymenium_axis_none() -> None:
    species = make(hymenium=None)
    assert not SERVICE.match(species, Selection(hymenium=frozenset({HymeniumType.GILLS})))


def test_match_cap_shape_is_or_within_axis() -> None:
    species = make(cap_shapes=frozenset({CapShape.CONVEX, CapShape.FLAT}))
    selection = Selection(cap_shape=frozenset({CapShape.FLAT, CapShape.BELL}))
    assert SERVICE.match(species, selection)
    assert not SERVICE.match(species, Selection(cap_shape=frozenset({CapShape.BELL})))


def test_match_terms_requires_all() -> None:
    one, two = uuid.uuid4(), uuid.uuid4()
    species = make(term_ids=frozenset({one, two}))
    assert SERVICE.match(species, Selection(terms=frozenset({one})))
    assert SERVICE.match(species, Selection(terms=frozenset({one, two})))
    assert not SERVICE.match(species, Selection(terms=frozenset({one, uuid.uuid4()})))


def test_match_months_wraps_year() -> None:
    species = make(period=(11, 2))
    assert SERVICE.match(species, Selection(months=frozenset({12})))
    assert SERVICE.match(species, Selection(months=frozenset({1})))
    assert not SERVICE.match(species, Selection(months=frozenset({6})))


def test_match_months_without_period() -> None:
    species = make(period=None)
    assert not SERVICE.match(species, Selection(months=frozenset({1})))


def test_match_colour_uses_nearest_standard_colour() -> None:
    species = make(colours={BodyPart.CAP: frozenset({"brown"})})
    assert SERVICE.match(species, Selection(colours={BodyPart.CAP: "#7a5230"}))
    assert not SERVICE.match(species, Selection(colours={BodyPart.CAP: "#ffffff"}))


def test_match_colour_missing_part() -> None:
    species = make(colours={})
    assert not SERVICE.match(species, Selection(colours={BodyPart.CAP: "#7a5230"}))


def test_match_size_overlap() -> None:
    species = make(measurements={(BodyPart.CAP, Dimension.WIDTH): (4.0, 12.0)})
    key = (BodyPart.CAP, Dimension.WIDTH)
    assert SERVICE.match(species, Selection(sizes={key: (5.0, 8.0)}))
    assert SERVICE.match(species, Selection(sizes={key: (None, 5.0)}))
    assert SERVICE.match(species, Selection(sizes={key: (10.0, None)}))
    assert not SERVICE.match(species, Selection(sizes={key: (20.0, None)}))
    assert not SERVICE.match(species, Selection(sizes={key: (None, 1.0)}))


def test_match_size_missing_measurement() -> None:
    species = make(measurements={})
    key = (BodyPart.CAP, Dimension.WIDTH)
    assert not SERVICE.match(species, Selection(sizes={key: (1.0, 2.0)}))


def test_selection_active() -> None:
    assert not Selection().active()
    assert Selection(months=frozenset({1})).active()

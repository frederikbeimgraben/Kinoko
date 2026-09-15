"""Tests des Laders: Achsen einer Art aus Zeile und Kindzeilen."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.models import Species, SpeciesTerm, Term
from app.modules.catalog.children import ChildRows
from app.modules.catalog.loader import build_facets
from app.shared.enums import Edibility, Group, Protection, TermKind


def species_row(latin_name: str = "Boletus edulis") -> Species:
    """Eine Artzeile ohne Datenbank."""
    return Species(
        id=uuid.uuid4(),
        slug="boletus-edulis",
        name="Steinpilz",
        latin_name=latin_name,
        group_key=Group.BOLETE,
        edibility=Edibility.EDIBLE,
        protection=Protection.NONE,
        forecast_enabled=False,
        updated_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


def test_facets_name_the_genus_from_the_latin_name() -> None:
    row = species_row()

    facets = build_facets(row, ChildRows([row.id]))

    assert facets.genus_name == "Boletus"
    assert facets.family_name is None


def test_facets_take_the_genus_of_the_taxonomy() -> None:
    row = species_row()

    facets = build_facets(row, ChildRows([row.id]), names=("Boletus", "Boletaceae"))

    assert facets.genus_name == "Boletus"
    assert facets.family_name == "Boletaceae"


def test_facets_sort_the_terms_by_kind() -> None:
    row = species_row()
    smell = Term(id=uuid.uuid4(), kind=TermKind.SMELL, slug="nussig", name="nussig", position=0)
    tree = Term(id=uuid.uuid4(), kind=TermKind.TREE, slug="fichte", name="Fichte", position=0)
    child = ChildRows([row.id])
    child.terms[row.id] = [
        SpeciesTerm(species_id=row.id, term_id=smell.id, from_experience=False),
        SpeciesTerm(species_id=row.id, term_id=tree.id, from_experience=False),
    ]

    facets = build_facets(row, child, {smell.id: smell, tree.id: tree})

    assert facets.senses == frozenset({"nussig"})
    assert facets.trees == frozenset({"fichte"})

"""Schemata der Taxonseite."""

from __future__ import annotations

import uuid

from pydantic import Field

from app.modules.catalog.schemas.species import SpeciesSummary
from app.shared.enums import TaxonRank
from app.shared.schema import Schema


class TaxonStep(Schema):
    """Ein Knoten der Einordnung, kurz."""

    id: uuid.UUID
    slug: str
    name: str
    rank: TaxonRank


class TaxonChild(TaxonStep):
    """Ein Kindtaxon mit seiner Artenzahl."""

    species_count: int


class TaxonPage(TaxonStep):
    """Die Seite eines Taxons: Weg, Nachbarn, Kinder, Arten."""

    description: str | None = None
    path: list[TaxonStep] = Field(default_factory=list)
    siblings: list[TaxonStep] = Field(default_factory=list)
    children: list[TaxonChild] = Field(default_factory=list)
    species: list[SpeciesSummary] = Field(default_factory=list)
    species_count: int


__all__ = ["TaxonChild", "TaxonPage", "TaxonStep"]

"""Schemata der Art: Zusammenfassung, Profil, Schreiben, Seiten."""

from __future__ import annotations

import uuid

from pydantic import Field

from app.modules.catalog.schemas.base import StandardColourEntry
from app.modules.catalog.schemas.parts import (
    CapFeatureEntry,
    CapMarginEntry,
    ColourChange,
    ColourGroup,
    Lookalike,
    LookalikeWrite,
    MeasurementGroup,
    SourceEntry,
    SpeciesNameEntry,
    SpeciesTermEntry,
    StemFeatureEntry,
    Trait,
)
from app.shared.enums import (
    CapShape,
    Edibility,
    Frequency,
    GillAttachment,
    GillEdge,
    GillSpacing,
    Group,
    HymeniumType,
    Protection,
    RedListStatus,
    Season,
)
from app.shared.schema import Schema, Timestamp


class SpeciesSummary(Schema):
    """Die Kurzform einer Art, für Listen."""

    id: uuid.UUID
    slug: str
    name: str
    scientific_name: str
    taxon_id: uuid.UUID | None = None
    group: Group
    edibility: Edibility
    protection: Protection
    forecast_enabled: bool
    lead_photo_id: uuid.UUID | None = None
    updated_at: Timestamp


class Species(SpeciesSummary):
    """Das volle Profil einer Art, mit allen Kindzeilen."""

    description: str | None = None
    marketable: bool
    frequency: Frequency | None = None
    red_list: RedListStatus | None = None
    edibility_note: str | None = None
    protection_note: str | None = None
    period_start_month: int | None = None
    period_end_month: int | None = None
    period_peak_month: int | None = None
    smell_text: str | None = None
    taste_text: str | None = None
    hymenium_type: HymeniumType | None = None
    gill_attachment: GillAttachment | None = None
    gill_spacing: GillSpacing | None = None
    gill_edge: GillEdge | None = None
    cap_shape_young: CapShape | None = None
    cap_shape_old: CapShape | None = None
    names: list[SpeciesNameEntry] = Field(default_factory=list)
    measurements: list[MeasurementGroup] = Field(default_factory=list)
    colours: list[ColourGroup] = Field(default_factory=list)
    colour_changes: list[ColourChange] = Field(default_factory=list)
    cap_features: list[CapFeatureEntry] = Field(default_factory=list)
    cap_margins: list[CapMarginEntry] = Field(default_factory=list)
    stem_features: list[StemFeatureEntry] = Field(default_factory=list)
    traits: list[Trait] = Field(default_factory=list)
    sources: list[SourceEntry] = Field(default_factory=list)
    seasons: list[Season] = Field(default_factory=list)
    terms: list[SpeciesTermEntry] = Field(default_factory=list)
    lookalikes: list[Lookalike] = Field(default_factory=list)


class SpeciesWrite(Schema):
    """Eine Art beim Anlegen oder Ersetzen."""

    name: str
    scientific_name: str
    taxon_id: uuid.UUID | None = None
    group: Group
    edibility: Edibility
    marketable: bool = False
    frequency: Frequency | None = None
    red_list: RedListStatus | None = None
    description: str | None = None
    edibility_note: str | None = None
    protection: Protection
    protection_note: str | None = None
    period_start_month: int | None = None
    period_end_month: int | None = None
    period_peak_month: int | None = None
    smell_text: str | None = None
    taste_text: str | None = None
    hymenium_type: HymeniumType | None = None
    gill_attachment: GillAttachment | None = None
    gill_spacing: GillSpacing | None = None
    gill_edge: GillEdge | None = None
    cap_shape_young: CapShape | None = None
    cap_shape_old: CapShape | None = None
    names: list[SpeciesNameEntry] = Field(default_factory=list)
    measurements: list[MeasurementGroup] = Field(default_factory=list)
    colours: list[ColourGroup] = Field(default_factory=list)
    colour_changes: list[ColourChange] = Field(default_factory=list)
    cap_features: list[CapFeatureEntry] = Field(default_factory=list)
    cap_margins: list[CapMarginEntry] = Field(default_factory=list)
    stem_features: list[StemFeatureEntry] = Field(default_factory=list)
    traits: list[Trait] = Field(default_factory=list)
    sources: list[SourceEntry] = Field(default_factory=list)
    seasons: list[Season] = Field(default_factory=list)
    terms: list[SpeciesTermEntry] = Field(default_factory=list)
    lookalikes: list[LookalikeWrite] = Field(default_factory=list)


class SpeciesCounts(Schema):
    """Die Zahlen einer Art zum Pflegen."""

    records: int
    finds: int
    photos: int


class SpeciesPage(Schema):
    """Eine Seite der Artenliste."""

    items: list[SpeciesSummary]
    next_cursor: str | None = None


class FacetsOut(Schema):
    """Die Achsen des Filters mit ihren belegten Werten."""

    edibility: list[Edibility] = Field(default_factory=list)
    hymenium: list[HymeniumType] = Field(default_factory=list)
    cap_shape: list[CapShape] = Field(default_factory=list)
    colours: dict[str, list[str]] = Field(default_factory=dict)
    months: list[int] = Field(default_factory=list)
    terms: list[uuid.UUID] = Field(default_factory=list)


class SpeciesBundle(Schema):
    """Der ganze Katalog in einem Zug."""

    items: list[Species]
    standard_colours: list[StandardColourEntry]
    facets: FacetsOut


__all__ = [
    "FacetsOut",
    "Species",
    "SpeciesBundle",
    "SpeciesCounts",
    "SpeciesPage",
    "SpeciesSummary",
    "SpeciesWrite",
]

"""Schemata der Kindzeilen einer Art."""

from __future__ import annotations

from datetime import date

from pydantic import Field

from app.modules.catalog.schemas.base import ColourValue, TermRef
from app.shared.enums import (
    BodyPart,
    CapFeature,
    CapMargin,
    ColourMode,
    Dimension,
    Edibility,
    NameKind,
    Phase,
    SourceScope,
    Speed,
    StemFeature,
    TraitKey,
    TriggerGroup,
    Unit,
)
from app.shared.schema import Schema, Timestamp


class ColourGroup(Schema):
    """Die Farben eines Körperteils."""

    part: BodyPart
    mode: ColourMode
    colours: list[ColourValue]


class ColourChange(Schema):
    """Eine Verfärbung eines Körperteils."""

    part: BodyPart
    kind: TriggerGroup
    from_: ColourValue | None = Field(default=None, alias="from")
    to: ColourValue
    speed: Speed | None = None
    triggers: list[TermRef] = Field(default_factory=list)


class Measurement(Schema):
    """Ein Maß einer Strecke."""

    dimension: Dimension
    unit: Unit
    low: float
    high: float


class MeasurementGroup(Schema):
    """Die Maße eines Körperteils."""

    part: BodyPart
    measurements: list[Measurement]


class PartNote(Schema):
    """Beschreibung und Kommentar zu einem Körperteil."""

    part: BodyPart
    description: str = ""
    comment: str = ""


class CapFeatureEntry(Schema):
    """Ein Merkmal der Hutfläche."""

    feature: CapFeature
    phase: Phase


class CapMarginEntry(Schema):
    """Ein Merkmal des Hutrandes."""

    margin: CapMargin
    phase: Phase


class StemFeatureEntry(Schema):
    """Ein Merkmal des Stiels."""

    feature: StemFeature
    phase: Phase


class Trait(Schema):
    """Ein Abschnitt der Merkmalsprosa."""

    key: TraitKey
    text: str


class SourceEntry(Schema):
    """Eine Quelle einer Art."""

    scope: SourceScope
    title: str
    url: str
    checked_on: date


class SpeciesNameEntry(Schema):
    """Ein weiterer Name einer Art."""

    name: str
    kind: NameKind


class SpeciesTermEntry(Schema):
    """Ein Begriff an einer Art."""

    term: TermRef
    from_experience: bool = False


class Lookalike(Schema):
    """Eine verwechselbare Art."""

    slug: str
    name: str
    scientific_name: str
    edibility: Edibility
    cap_colours: list[ColourValue] = Field(default_factory=list)
    difference: str | None = None


class LookalikeWrite(Schema):
    """Der Verweis auf eine verwechselbare Art beim Schreiben."""

    slug: str
    difference: str


__all__ = [
    "CapFeatureEntry",
    "CapMarginEntry",
    "ColourChange",
    "ColourGroup",
    "Lookalike",
    "LookalikeWrite",
    "Measurement",
    "MeasurementGroup",
    "SourceEntry",
    "SpeciesNameEntry",
    "SpeciesTermEntry",
    "StemFeatureEntry",
    "Timestamp",
    "Trait",
]

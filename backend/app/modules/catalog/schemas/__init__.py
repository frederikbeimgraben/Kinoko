"""Die Schemata des Katalogs, an einer Stelle."""

from __future__ import annotations

from app.modules.catalog.schemas.base import ColourValue, StandardColourEntry, TermRef
from app.modules.catalog.schemas.parts import (
    CapFeatureEntry,
    CapMarginEntry,
    ColourChange,
    ColourGroup,
    Lookalike,
    LookalikeWrite,
    Measurement,
    MeasurementGroup,
    PartNote,
    SourceEntry,
    SpeciesNameEntry,
    SpeciesTermEntry,
    StemFeatureEntry,
    Trait,
)
from app.modules.catalog.schemas.species import (
    Species,
    SpeciesBundle,
    SpeciesCounts,
    SpeciesPage,
    SpeciesSummary,
    SpeciesWrite,
)
from app.modules.catalog.schemas.taxonomy import TaxonChild, TaxonPage, TaxonStep
from app.modules.catalog.schemas.terms import Term, TermCreate, TermUpdate

__all__ = [
    "CapFeatureEntry",
    "CapMarginEntry",
    "ColourChange",
    "ColourGroup",
    "ColourValue",
    "Lookalike",
    "LookalikeWrite",
    "Measurement",
    "MeasurementGroup",
    "PartNote",
    "SourceEntry",
    "Species",
    "SpeciesBundle",
    "SpeciesCounts",
    "SpeciesNameEntry",
    "SpeciesPage",
    "SpeciesSummary",
    "SpeciesTermEntry",
    "SpeciesWrite",
    "StandardColourEntry",
    "StemFeatureEntry",
    "TaxonChild",
    "TaxonPage",
    "TaxonStep",
    "Term",
    "TermCreate",
    "TermRef",
    "TermUpdate",
    "Trait",
]

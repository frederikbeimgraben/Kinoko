"""Öffentliche Schnittstelle des Katalogimports."""

from __future__ import annotations

from app.modules.catalog.importer.build import build_species
from app.modules.catalog.importer.context import BuildContext, Report, TermRegistry
from app.modules.catalog.importer.loader import SPECIES_DIR, import_all
from app.modules.catalog.importer.taxonomy import load_taxonomy
from app.modules.catalog.importer.terms import build_terms

__all__ = [
    "SPECIES_DIR",
    "BuildContext",
    "Report",
    "TermRegistry",
    "build_species",
    "build_terms",
    "import_all",
    "load_taxonomy",
]

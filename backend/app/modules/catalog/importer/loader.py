"""Lädt Profile und Taxonomie und schreibt sie als Katalog in die Sitzung."""

from __future__ import annotations

import json
import tomllib
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, Any

from sqlalchemy import delete

from app.models import Species, SpeciesColour, SpeciesColourChangeTrigger, Taxon, Term, new_id
from app.modules.catalog.importer.build import build_species
from app.modules.catalog.importer.context import BuildContext, Report
from app.modules.catalog.importer.taxonomy import load_taxonomy
from app.modules.catalog.importer.terms import build_colour_vocabulary, build_terms
from tools import catalog_vocabulary as vocab

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

ROOT: Path = Path(__file__).resolve().parents[4]
DATA_DIR: Path = ROOT / "daten"
SPECIES_DIR: Path = DATA_DIR / "arten"
TAXONOMY_PATH: Path = DATA_DIR / "taxonomie.json"


def _load_species_profiles(directory: Path) -> dict[str, dict[str, Any]]:
    """Liest jede TOML-Datei eines Ordners, den Dateinamen als Schlüssel."""
    profiles: dict[str, dict[str, Any]] = {}
    for path in sorted(directory.glob("*.toml")):
        with path.open("rb") as handle:
            profiles[path.stem] = tomllib.load(handle)
    return profiles


def _load_taxon_entries(path: Path) -> list[dict[str, Any]]:
    """Liest die Taxa aus ``taxonomie.json``."""
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return data["taxa"]


async def _clear_catalog(session: AsyncSession) -> None:
    """Leert Arten, Begriffe und Taxa vor einem neuen Import."""
    await session.execute(delete(Species))
    await session.execute(delete(Term))
    await session.execute(delete(Taxon))
    await session.flush()


async def import_all(session: AsyncSession, report: Report) -> None:
    """Baut Taxa, Begriffe und Arten und schreibt sie in die Sitzung."""
    taxon_entries = _load_taxon_entries(TAXONOMY_PATH)
    taxon_rows, _taxon_ids, genus_ids = load_taxonomy(taxon_entries)

    profiles = _load_species_profiles(SPECIES_DIR)
    identities = {
        stem: (new_id(), vocab.slugify(profile["lateinisch"])) for stem, profile in profiles.items()
    }
    species_ids = {stem: identity[0] for stem, identity in identities.items()}

    catalog_colours = build_colour_vocabulary(profiles)
    terms = build_terms(profiles)

    seen_pairs: set[tuple[uuid.UUID, uuid.UUID]] = set()
    species_rows: list[Species] = []
    child_rows: list[object] = []
    for stem, profile in profiles.items():
        species_id, slug = identities[stem]
        ctx = BuildContext(
            stem=stem,
            profile=profile,
            species_id=species_id,
            slug=slug,
            genus_ids=genus_ids,
            terms=terms,
            colours=catalog_colours,
            species_ids=species_ids,
            report=report,
            seen_pairs=seen_pairs,
        )
        row, children_rows, counts = build_species(ctx)
        species_rows.append(row)
        child_rows += children_rows
        report.counts += counts

    late = (SpeciesColour, SpeciesColourChangeTrigger)
    early_rows = [row for row in child_rows if not isinstance(row, late)]
    late_rows = [row for row in child_rows if isinstance(row, late)]

    await _clear_catalog(session)
    session.add_all(taxon_rows)
    session.add_all(terms.rows)
    await session.flush()
    session.add_all(species_rows)
    await session.flush()
    session.add_all(early_rows)
    await session.flush()
    session.add_all(late_rows)
    await session.commit()

    report.counts["species"] = len(species_rows)
    report.counts["taxa"] = len(taxon_rows)
    report.counts["terms"] = len(terms.rows)

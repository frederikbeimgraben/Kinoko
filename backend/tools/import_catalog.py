"""Schreibt die TOML-Profile aus ``daten/arten`` in den Artenkatalog."""

from __future__ import annotations

import argparse
import asyncio
import json
import tomllib
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import delete, event
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import ConnectionPoolEntry

from app.core.settings import get_settings
from app.models import Base, Species, SpeciesColour, SpeciesColourChangeTrigger, Taxon, Term, new_id
from tools import catalog_vocabulary as vocab
from tools.catalog_rows import (
    BuildContext,
    Report,
    build_colour_vocabulary,
    build_species,
    build_terms,
    load_taxonomy,
)

ROOT: Path = Path(__file__).resolve().parent.parent
DATA_DIR: Path = ROOT / "daten"
SPECIES_DIR: Path = DATA_DIR / "arten"
TAXONOMY_PATH: Path = DATA_DIR / "taxonomie.json"


def load_species_profiles(directory: Path) -> dict[str, dict[str, Any]]:
    """Liest jede TOML-Datei eines Ordners, den Dateinamen als Schlüssel."""
    profiles: dict[str, dict[str, Any]] = {}
    for path in sorted(directory.glob("*.toml")):
        with path.open("rb") as handle:
            profiles[path.stem] = tomllib.load(handle)
    return profiles


def load_taxon_entries(path: Path) -> list[dict[str, Any]]:
    """Liest die Taxa aus ``taxonomie.json``."""
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return data["taxa"]


def enforce_foreign_keys(made: AsyncEngine) -> None:
    """Schaltet die Fremdschlüsselprüfung je Verbindung ein."""

    def switch_on(connection: DBAPIConnection, _record: ConnectionPoolEntry) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    event.listen(made.sync_engine, "connect", switch_on)


async def clear_catalog(session: AsyncSession) -> None:
    """Leert Arten, Begriffe und Taxa vor einem neuen Import."""
    await session.execute(delete(Species))
    await session.execute(delete(Term))
    await session.execute(delete(Taxon))
    await session.flush()


async def import_all(session: AsyncSession, report: Report) -> None:
    """Baut Taxa, Begriffe und Arten und schreibt sie in die Sitzung."""
    taxon_entries = load_taxon_entries(TAXONOMY_PATH)
    taxon_rows, _taxon_ids, genus_ids = load_taxonomy(taxon_entries)

    profiles = load_species_profiles(SPECIES_DIR)
    identities = {
        stem: (new_id(), vocab.slugify(profile["lateinisch"])) for stem, profile in profiles.items()
    }
    species_ids = {stem: identity[0] for stem, identity in identities.items()}

    colours = build_colour_vocabulary(profiles)
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
            colours=colours,
            species_ids=species_ids,
            report=report,
            seen_pairs=seen_pairs,
        )
        row, children, counts = build_species(ctx)
        species_rows.append(row)
        child_rows += children
        report.counts += counts

    late = (SpeciesColour, SpeciesColourChangeTrigger)
    early_rows = [row for row in child_rows if not isinstance(row, late)]
    late_rows = [row for row in child_rows if isinstance(row, late)]

    await clear_catalog(session)
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


async def run(db_url: str | None) -> Report:
    """Öffnet die Datenbank, legt fehlende Tabellen an und importiert."""
    url = db_url or get_settings().db
    engine = create_async_engine(url)
    enforce_foreign_keys(engine)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    report = Report()
    async with session_factory() as session:
        await import_all(session, report)
    await engine.dispose()
    return report


TOP_LEVEL_COUNTS: tuple[str, ...] = ("species", "taxa", "terms")


def print_report(report: Report) -> None:
    """Gibt die Zählung des Laufs aus."""
    for key in TOP_LEVEL_COUNTS:
        print(f"{key}: {report.counts[key]}")
    for key in sorted(k for k in report.counts if k not in TOP_LEVEL_COUNTS):
        print(f"{key}: {report.counts[key]}")
    for key in sorted(report.skipped):
        print(f"übersprungen {key}: {report.skipped[key]}")


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    """Liest die Kommandozeile: nur die Datenbank-URL ist wählbar."""
    parser = argparse.ArgumentParser(description="Importiert den Artenkatalog in die Datenbank.")
    parser.add_argument("--db", default=None, help="Datenbank-URL, sonst PILZE_DB.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    """Startet den Import und gibt seinen Bericht aus."""
    args = parse_args(argv)
    report = asyncio.run(run(args.db))
    print_report(report)


if __name__ == "__main__":  # pragma: no cover
    main()

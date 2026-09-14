"""CLI: importiert den Artenkatalog über ``app.modules.catalog.importer``."""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import event
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlalchemy.pool import ConnectionPoolEntry

from app.core.settings import get_settings
from app.models import Base
from app.modules.catalog.importer import Report, import_all


def enforce_foreign_keys(made: AsyncEngine) -> None:
    """Schaltet die Fremdschlüsselprüfung je Verbindung ein."""

    def switch_on(connection: DBAPIConnection, _record: ConnectionPoolEntry) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    event.listen(made.sync_engine, "connect", switch_on)


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

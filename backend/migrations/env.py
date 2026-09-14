"""Alembic gegen die Datenbank aus ``PILZE_DB``."""

from __future__ import annotations

import asyncio

from alembic import context
from sqlalchemy import Connection

from app.core.db import build_engine, create_folder
from app.core.settings import get_settings
from app.models import Base

target_metadata = Base.metadata

RESET_EXCLUDED: frozenset[str] = frozenset({"sqlite_sequence"})


def existing_tables(connection: Connection) -> list[str]:
    """Listet die Tabellen aus ``sqlite_master``."""
    rows = connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'")
    return [row[0] for row in rows if row[0] not in RESET_EXCLUDED]


def stored_revision(connection: Connection, tables: list[str]) -> str | None:
    """Liest die Revision aus ``alembic_version``, ``None`` ohne Tabelle."""
    if "alembic_version" not in tables:
        return None
    row = connection.exec_driver_sql("SELECT version_num FROM alembic_version").first()
    return row[0] if row else None


def known_revisions() -> set[str]:
    """Die Revisionen, die das Skriptverzeichnis kennt."""
    return {rev.revision for rev in context.script.walk_revisions()}


def reset_if_unknown(connection: Connection) -> None:
    """Löscht alle Tabellen, wenn ohne bekannte Revision welche stehen."""
    tables = existing_tables(connection)
    revision = stored_revision(connection, tables)
    known = revision is not None and revision in known_revisions()
    if known or not tables:
        connection.rollback()
        return
    for table in tables:
        connection.exec_driver_sql(f'DROP TABLE "{table}"')
    connection.commit()


def run(connection: Connection) -> None:
    """Setzt eine fremde Datenbank zurück, dann führt sie die Wanderung aus."""
    reset_if_unknown(connection)
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


async def online() -> None:
    """Öffnet die Datenbank und wandert."""
    create_folder(get_settings().db)
    engine = build_engine()
    async with engine.connect() as connection:
        await connection.run_sync(run)
    await engine.dispose()


def offline() -> None:
    """Schreibt die Anweisungen, ohne zu verbinden."""
    context.configure(url=get_settings().db, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    offline()
else:
    asyncio.run(online())

"""Alembic gegen die Datenbank aus ``PILZE_DB``."""

from __future__ import annotations

import asyncio

from alembic import context
from sqlalchemy import Connection

from app.core.db import build_engine, create_folder
from app.core.settings import get_settings
from app.models import Base

target_metadata = Base.metadata


def run(connection: Connection) -> None:
    """Führt die Wanderung auf einer offenen Verbindung aus."""
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

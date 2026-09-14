"""Zugang zur SQLite-Datenbank."""

from collections.abc import AsyncGenerator
from functools import lru_cache
from pathlib import Path
from typing import Final

from sqlalchemy import event
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import ConnectionPoolEntry

from app.core.settings import get_settings

FILE_PREFIX: Final = "sqlite+aiosqlite:///"


def create_folder(url: str) -> None:
    """Legt den Ordner der SQLite-Datei an, falls er fehlt."""
    if not url.startswith(FILE_PREFIX):
        return
    Path(url.removeprefix(FILE_PREFIX)).parent.mkdir(parents=True, exist_ok=True)


def enforce_keys(made: AsyncEngine) -> None:
    """Schaltet die Fremdschlüssel ein. Die Pragma gilt je Verbindung."""

    def switch_on(connection: DBAPIConnection, _record: ConnectionPoolEntry) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    event.listen(made.sync_engine, "connect", switch_on)


def build_engine() -> AsyncEngine:
    """Baut eine Engine auf die Datei aus ``PILZE_DB`` und legt ihren Ordner an."""
    url = get_settings().db
    create_folder(url)
    return create_async_engine(url)


@lru_cache(maxsize=1)
def engine() -> AsyncEngine:
    """Liefert die Engine des Prozesses. Sie prüft die Fremdschlüssel."""
    made = build_engine()
    enforce_keys(made)
    return made


@lru_cache(maxsize=1)
def session_factory() -> async_sessionmaker[AsyncSession]:
    """Liefert die Sitzungsfabrik des Prozesses."""
    return async_sessionmaker(engine(), expire_on_commit=False)


async def session() -> AsyncGenerator[AsyncSession]:
    """Dependency: eine Sitzung je Anfrage."""
    async with session_factory()() as open_one:
        yield open_one

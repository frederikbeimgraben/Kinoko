"""Katalogimport beim Start, wenn die Artentabelle leer ist."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import func, select

from app.models import Species
from tools import catalog_rows
from tools.import_catalog import import_all

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def sync(db: AsyncSession) -> None:
    """Importiert ``daten/arten``, wenn noch keine Art in der Tabelle steht."""
    total = (await db.execute(select(func.count()).select_from(Species))).scalar_one()
    if total:
        return
    await import_all(db, catalog_rows.Report())

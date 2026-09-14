"""Rechte und eingebaute Rollen beim Start."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def sync(db: AsyncSession) -> None:
    """Schreibt fehlende Rechte und Rollen nach."""

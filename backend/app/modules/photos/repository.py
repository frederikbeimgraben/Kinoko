"""Der Zugang zur Tabelle photo."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models import Photo
from app.shared.enums import PhotoState
from app.shared.repository import OwnedRepository

if TYPE_CHECKING:
    import uuid
    from collections.abc import Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.shared.paging import Paging


class PhotoRepository(OwnedRepository[Photo]):
    """Der Zugang zur Tabelle photo."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Photo)

    async def leads(self, species_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, uuid.UUID]:
        """Bildet jede Art auf ihr Titelfoto ab: das gewählte, sonst das älteste freigegebene."""
        if not species_ids:
            return {}
        query = (
            select(Photo.species_id, Photo.id)
            .where(Photo.species_id.in_(species_ids), Photo.state == PhotoState.APPROVED)
            .order_by(Photo.species_id, Photo.lead.desc(), Photo.created_at.asc())
        )
        found = await self.db.execute(query)
        leads: dict[uuid.UUID, uuid.UUID] = {}
        for species_id, photo_id in found:
            if species_id is not None and species_id not in leads:
                leads[species_id] = photo_id
        return leads

    async def submissions(self, state: PhotoState, paging: Paging) -> Sequence[Photo]:
        """Liest eine Seite Fotos in einem Stand, neueste zuerst."""
        query = self.query().where(Photo.state == state).order_by(Photo.created_at.desc())
        return await self.list(query, paging)

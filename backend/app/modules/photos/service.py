"""Der Dienst der Fotos: sichten, freigeben, ablehnen, einordnen."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import and_, or_

from app.core.auth import Viewer
from app.core.errors import Conflict, Forbidden, NotFound, Unauthorized
from app.models import Photo, User, now
from app.modules.photos.repository import PhotoRepository
from app.modules.photos.schemas import PhotoOut
from app.shared import images
from app.shared.enums import PhotoState
from app.shared.paging import page

if TYPE_CHECKING:
    from pathlib import Path

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.shared.paging import Paging

RIGHT = "image.review"


def out(photo: Photo) -> PhotoOut:
    """Baut das Schema eines Fotos."""
    return PhotoOut.model_validate(photo)


def visible(photo: Photo, viewer: Viewer) -> bool:
    """Sagt, ob ein Foto für den Aufrufer sichtbar ist."""
    if photo.state == PhotoState.APPROVED and photo.species_id is not None:
        return True
    return viewer.owns(photo.owner_id) or viewer.may(RIGHT)


async def visible_or_404(repo: PhotoRepository, photo_id: uuid.UUID, viewer: Viewer) -> Photo:
    """Liest ein Foto, sonst 404, wenn es nicht sichtbar ist."""
    found = await repo.get(photo_id)
    if found is None or not visible(found, viewer):
        raise NotFound
    return found


async def approve(
    db: AsyncSession, repo: PhotoRepository, photo_id: uuid.UUID, reviewer: User
) -> Photo:
    """Gibt ein Foto frei."""
    photo = await repo.get_or_404(photo_id)
    photo.state = PhotoState.APPROVED
    photo.reviewed_by_id = reviewer.id
    photo.reviewed_at = now()
    photo.reject_reason = None
    await db.commit()
    await db.refresh(photo)
    return photo


async def reject(
    db: AsyncSession,
    repo: PhotoRepository,
    photo_id: uuid.UUID,
    reviewer: User,
    reason: str,
) -> Photo:
    """Lehnt ein Foto ab."""
    photo = await repo.get_or_404(photo_id)
    photo.state = PhotoState.REJECTED
    photo.reviewed_by_id = reviewer.id
    photo.reviewed_at = now()
    photo.reject_reason = reason
    await db.commit()
    await db.refresh(photo)
    return photo


async def set_lead(
    db: AsyncSession, repo: PhotoRepository, photo_id: uuid.UUID, viewer: Viewer
) -> Photo:
    """Macht ein freigegebenes Artfoto zum Titelbild. Das alte verliert den Rang."""
    photo = await repo.get(photo_id)
    if photo is None or not visible(photo, viewer):
        raise NotFound
    if viewer.user is None:
        raise Unauthorized
    if not (viewer.owns(photo.owner_id) or viewer.may(RIGHT)):
        raise Forbidden
    if photo.state != PhotoState.APPROVED or photo.species_id is None:
        raise Conflict
    previous = await repo.one(Photo.species_id == photo.species_id, Photo.lead.is_(True))
    if previous is not None and previous.id != photo.id:
        previous.lead = False
    photo.lead = True
    await db.commit()
    await db.refresh(photo)
    return photo


async def delete(
    db: AsyncSession,
    root: Path,
    repo: PhotoRepository,
    photo_id: uuid.UUID,
    viewer: Viewer,
) -> None:
    """Löscht ein Foto: die Zeile und seine Dateien."""
    photo = await repo.get(photo_id)
    if photo is None or not visible(photo, viewer):
        raise NotFound
    if viewer.user is None:
        raise Unauthorized
    if not (viewer.owns(photo.owner_id) or viewer.may(RIGHT)):
        raise Forbidden
    await repo.delete(photo)
    await db.commit()
    images.remove(root, photo.id)


async def list_photos(  # noqa: PLR0913, PLR0917
    db: AsyncSession,
    repo: PhotoRepository,
    viewer: Viewer,
    paging: Paging,
    state: PhotoState | None,
    species_id: uuid.UUID | None,
    find_id: uuid.UUID | None,
    mine: bool,  # noqa: FBT001
) -> dict[str, Any]:
    """Blättert durch Fotos, nach dem, was der Aufrufer sehen darf."""
    query = repo.query()
    if mine:
        if viewer.user is None:
            raise Unauthorized
        query = query.where(Photo.owner_id == viewer.user.id)
    elif not viewer.may(RIGHT):
        public = and_(Photo.state == PhotoState.APPROVED, Photo.species_id.is_not(None))
        if viewer.user is not None:
            query = query.where(or_(public, Photo.owner_id == viewer.user.id))
        else:
            query = query.where(public)
    if state is not None:
        query = query.where(Photo.state == state)
    if species_id is not None:
        query = query.where(Photo.species_id == species_id)
    if find_id is not None:
        query = query.where(Photo.find_id == find_id)
    query = query.order_by(Photo.created_at.desc())
    return await page(db, query, paging, out)

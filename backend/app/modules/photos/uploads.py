"""Die Annahme eines Fotos: an einen Fund, an eine Art, oder für sich."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING

from app.core.errors import Conflict, NotFound
from app.core.settings import get_settings
from app.models import Find, Photo, Species, User
from app.modules.photos.repository import PhotoRepository
from app.shared import images
from app.shared.enums import Licence, PhotoState, Protection
from app.shared.geometry import coarse

if TYPE_CHECKING:
    from pathlib import Path

    from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True, slots=True)
class Arrival:
    """Ein hochgeladenes Bild mit seinen Angaben."""

    raw: bytes
    media_type: str | None
    photographer: str
    licence: Licence
    caption: str | None
    source: str | None
    taken_on: date | None
    species_id: uuid.UUID | None
    find_id: uuid.UUID | None


async def own_find(db: AsyncSession, find_id: uuid.UUID, user: User) -> Find:
    """Liest einen eigenen Fund, sonst 404."""
    found = await db.get(Find, find_id)
    if found is None or found.owner_id != user.id or found.deleted_at is not None:
        raise NotFound
    return found


async def existing_species(db: AsyncSession, species_id: uuid.UUID) -> Species:
    """Liest eine Art, sonst 404."""
    found = await db.get(Species, species_id)
    if found is None:
        raise NotFound
    return found


async def location_for_find(db: AsyncSession, find: Find) -> tuple[float | None, float | None]:
    """Der Ort eines Fotos an einem Fund: gerundet, oder gar nicht."""
    if find.species_id is None:
        return None, None
    species = await db.get(Species, find.species_id)
    if species is None or species.protection == Protection.NONE:
        return None, None
    lon, lat = coarse((find.lon, find.lat))
    return lat, lon


async def create(db: AsyncSession, root: Path, user: User, arrival: Arrival) -> Photo:
    """Nimmt ein Foto an: an einen Fund, an eine Art, oder für sich."""
    if arrival.find_id is not None:
        return await attach(db, root, user, arrival.find_id, arrival)
    return await submit(db, root, user, arrival)


async def attach(
    db: AsyncSession,
    root: Path,
    user: User,
    find_id: uuid.UUID,
    arrival: Arrival,
) -> Photo:
    """Hängt ein Foto an einen eigenen Fund. Der Stand ist privat."""
    find = await own_find(db, find_id, user)
    rendered = images.accept(arrival.raw, arrival.media_type, get_settings().max_photo_bytes)
    lat, lon = await location_for_find(db, find)
    photo = Photo(
        owner_id=user.id,
        find_id=find.id,
        species_id=None,
        width=rendered.width,
        height=rendered.height,
        photographer=arrival.photographer,
        licence=arrival.licence,
        caption=arrival.caption,
        source=arrival.source,
        taken_on=arrival.taken_on,
        lat=lat,
        lon=lon,
        state=PhotoState.PRIVATE,
    )
    db.add(photo)
    await db.flush()
    images.write(root, photo.id, rendered)
    await db.commit()
    await db.refresh(photo)
    return photo


async def submit(db: AsyncSession, root: Path, user: User, arrival: Arrival) -> Photo:
    """Reicht ein Foto ein: an eine Art, oder als privates Bild ohne Fund."""
    repo = PhotoRepository(db)
    rendered = images.accept(arrival.raw, arrival.media_type, get_settings().max_photo_bytes)
    species: Species | None = None
    state = PhotoState.PRIVATE
    if arrival.species_id is not None:
        species = await existing_species(db, arrival.species_id)
        state = PhotoState.SUBMITTED
        pending = await repo.one(
            Photo.owner_id == user.id,
            Photo.species_id == species.id,
            Photo.find_id.is_(None),
            Photo.state == PhotoState.REJECTED,
        )
        if pending is not None:
            return await resubmit_with(db, root, pending, arrival, rendered, user)
    photo = Photo(
        owner_id=user.id,
        find_id=None,
        species_id=species.id if species is not None else None,
        width=rendered.width,
        height=rendered.height,
        photographer=arrival.photographer,
        licence=arrival.licence,
        caption=arrival.caption,
        source=arrival.source,
        taken_on=arrival.taken_on,
        lat=None,
        lon=None,
        state=state,
    )
    db.add(photo)
    await db.flush()
    images.write(root, photo.id, rendered)
    await db.commit()
    await db.refresh(photo)
    return photo


async def resubmit_with(  # noqa: PLR0913, PLR0917
    db: AsyncSession,
    root: Path,
    photo: Photo,
    arrival: Arrival,
    rendered: images.Rendered,
    user: User,
) -> Photo:
    """Ersetzt das Bild eines abgelehnten Fotos vor der Neueinreichung."""
    photo.width = rendered.width
    photo.height = rendered.height
    photo.photographer = arrival.photographer
    photo.licence = arrival.licence
    photo.caption = arrival.caption
    photo.taken_on = arrival.taken_on
    images.write(root, photo.id, rendered)
    return await resubmit(db, photo, user)


async def resubmit(db: AsyncSession, photo: Photo, user: User) -> Photo:
    """Reicht ein abgelehntes eigenes Foto neu ein."""
    if photo.owner_id != user.id or photo.state != PhotoState.REJECTED:
        raise Conflict
    photo.state = PhotoState.SUBMITTED
    photo.reject_reason = None
    photo.reviewed_by_id = None
    photo.reviewed_at = None
    await db.commit()
    await db.refresh(photo)
    return photo

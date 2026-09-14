"""Der Datenexport eines Kontos: eigene Funde, Objekte und Fotos."""

from __future__ import annotations

import json
import uuid
from datetime import date
from typing import TYPE_CHECKING, Any

from sqlalchemy import select

from app.models import Combination, Find, Marker, Photo, Zone
from app.modules.access.schemas import ExportFind, ExportMarker, Factor, GeoPolygon, Me
from app.shared.enums import Licence, MarkerColour, Rule, Visibility
from app.shared.schema import Schema, Timestamp

if TYPE_CHECKING:
    from sqlalchemy import Select
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import User


class ExportZone(Schema):
    """Eine eigene Zone im Datenexport."""

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    polygon: GeoPolygon
    area_ha: float
    colour: MarkerColour
    visibility: Visibility
    note: str | None = None
    created_at: Timestamp
    updated_at: Timestamp
    deleted: bool = False

    @classmethod
    def of(cls, row: Zone) -> ExportZone:
        """Baut den Eintrag aus einer Zone."""
        return cls(
            id=row.id,
            owner_id=row.owner_id,
            name=row.name,
            polygon=json.loads(row.polygon),
            area_ha=row.area_ha,
            colour=row.colour,
            visibility=row.visibility,
            note=row.note,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


class ExportCombination(Schema):
    """Eine eigene Kombination im Datenexport."""

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    rule: Rule
    factors: list[Factor]
    created_at: Timestamp
    updated_at: Timestamp
    deleted: bool = False

    @classmethod
    def of(cls, row: Combination) -> ExportCombination:
        """Baut den Eintrag aus einer Kombination."""
        return cls(
            id=row.id,
            owner_id=row.owner_id,
            name=row.name,
            rule=row.rule,
            factors=json.loads(row.factors),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


class ExportPhoto(Schema):
    """Ein eigenes Foto im Datenexport."""

    id: uuid.UUID
    owner_id: uuid.UUID
    species_id: uuid.UUID | None = None
    find_id: uuid.UUID | None = None
    width: int
    height: int
    photographer: str
    licence: Licence
    caption: str | None = None
    taken_on: date | None = None
    lat: float | None = None
    lon: float | None = None
    lead: bool
    state: str
    reject_reason: str | None = None
    reviewed_by_id: uuid.UUID | None = None
    reviewed_at: Timestamp | None = None
    created_at: Timestamp
    updated_at: Timestamp

    @classmethod
    def of(cls, row: Photo, owner_id: uuid.UUID) -> ExportPhoto:
        """Baut den Eintrag aus einem Foto. ``owner_id`` steht für die Suche."""
        return cls(
            id=row.id,
            owner_id=owner_id,
            species_id=row.species_id,
            find_id=row.find_id,
            width=row.width,
            height=row.height,
            photographer=row.photographer,
            licence=row.licence,
            caption=row.caption,
            taken_on=row.taken_on,
            lat=row.lat,
            lon=row.lon,
            lead=row.lead,
            state=row.state,
            reject_reason=row.reject_reason,
            reviewed_by_id=row.reviewed_by_id,
            reviewed_at=row.reviewed_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


class AccountExport(Schema):
    """Das eigene Konto mit allen eigenen Daten."""

    me: Me
    finds: list[ExportFind]
    markers: list[ExportMarker]
    zones: list[ExportZone]
    combinations: list[ExportCombination]
    photos: list[ExportPhoto]


async def _rows[T](db: AsyncSession, query: Select[tuple[T]]) -> list[T]:
    found = await db.execute(query)
    return list(found.scalars())


async def build(db: AsyncSession, user: User) -> dict[str, Any]:
    """Baut den Datenexport eines Kontos."""
    finds = await _rows(db, select(Find).where(Find.owner_id == user.id, Find.deleted_at.is_(None)))
    markers = await _rows(
        db,
        select(Marker).where(Marker.owner_id == user.id, Marker.deleted_at.is_(None)),
    )
    zones = await _rows(db, select(Zone).where(Zone.owner_id == user.id, Zone.deleted_at.is_(None)))
    combinations = await _rows(
        db,
        select(Combination).where(
            Combination.owner_id == user.id,
            Combination.deleted_at.is_(None),
        ),
    )
    photos = await _rows(db, select(Photo).where(Photo.owner_id == user.id))
    return AccountExport(
        me=Me(id=user.id, sub=user.sub, email=user.email, name=user.name),
        finds=[ExportFind.of(row) for row in finds],
        markers=[ExportMarker.of(row) for row in markers],
        zones=[ExportZone.of(row) for row in zones],
        combinations=[ExportCombination.of(row) for row in combinations],
        photos=[ExportPhoto.of(row, user.id) for row in photos],
    ).dumped()

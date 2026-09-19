"""Endpunkte der Zonen und ihr Vorhersagewert."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Any

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select

from app.core.auth import CurrentUser, Db
from app.core.settings import get_settings
from app.models import Find, Species, Zone
from app.modules.objects import tiles
from app.modules.objects.repository import ZoneRepository
from app.modules.objects.schemas import GeoPolygon, ZoneSchema, ZoneValueSchema, ZoneWrite
from app.modules.objects.service import ObjectService
from app.modules.objects.visibility import group_of
from app.shared.geometry import area_ha, point_in_polygon
from app.shared.paging import Page

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import User
    from app.shared.geometry import Ring

router = APIRouter(tags=["zones"])


def _service(db: Db) -> ObjectService[Zone]:
    return ObjectService(ZoneRepository(db))


async def _values(db: Db, user: User, body: ZoneWrite) -> dict[str, Any]:
    return {
        "name": body.name,
        "polygon": body.polygon.model_dump_json(),
        "area_ha": area_ha(body.polygon.outer_ring()),
        "colour": body.colour,
        "visibility": body.visibility,
        "group_id": await group_of(db, user, body.visibility, body.group_id),
        "note": body.note,
    }


@router.get("/zones")
async def list_zones(
    db: Db,
    user: CurrentUser,
    paging: Page,
    since: Annotated[datetime | None, Query()] = None,
) -> Any:  # noqa: ANN401
    """Eigene Zonen, geblättert."""
    service = _service(db)
    if since is None:
        return await service.list(user, paging, ZoneSchema.of)
    return await service.changes_since(user, since, paging, ZoneSchema.of)


@router.post("/zones", status_code=status.HTTP_201_CREATED)
async def create_zone(db: Db, user: CurrentUser, body: ZoneWrite) -> Any:  # noqa: ANN401
    """Legt eine Zone an."""
    entity = Zone(owner_id=user.id, **(await _values(db, user, body)))
    created = await _service(db).create(entity)
    return ZoneSchema.of(created).dumped()


@router.get("/zones/{zone_id}")
async def get_zone(db: Db, user: CurrentUser, zone_id: uuid.UUID) -> Any:  # noqa: ANN401
    """Liest eine eigene Zone."""
    found = await _service(db).read(user, zone_id)
    return ZoneSchema.of(found).dumped()


@router.put("/zones/{zone_id}")
async def put_zone(
    db: Db,
    user: CurrentUser,
    zone_id: uuid.UUID,
    body: ZoneWrite,
    response: Response,
) -> Any:  # noqa: ANN401
    """Legt die Zone mit dieser Kennung an, oder ersetzt sie."""
    values = await _values(db, user, body)
    entity, created = await _service(db).update(
        user,
        zone_id,
        lambda: Zone(id=zone_id, owner_id=user.id, **values),
        values,
    )
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return ZoneSchema.of(entity).dumped()


@router.delete("/zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(db: Db, user: CurrentUser, zone_id: uuid.UUID) -> None:
    """Löscht eine eigene Zone weich."""
    await _service(db).delete(user, zone_id)


@dataclass(frozen=True, slots=True)
class ZoneValueQuery:
    """Art, Jahr und Woche eines Vorhersagewerts."""

    species_id: uuid.UUID
    year: int
    week: int


def zone_value_query(
    species_id: Annotated[uuid.UUID, Query(alias="speciesId")],
    year: Annotated[int, Query()],
    week: Annotated[int, Query(ge=1, le=53)],
) -> ZoneValueQuery:
    """Dependency: Art, Jahr und Woche aus der Abfrage."""
    return ZoneValueQuery(species_id=species_id, year=year, week=week)


ZoneValueQueryDep = Annotated[ZoneValueQuery, Depends(zone_value_query)]


async def _tile_value(db: AsyncSession, ring: Ring, query: ZoneValueQuery) -> tuple[float, int]:
    """Mittelt die Kacheln der Art unter der Fläche."""
    species = await db.get(Species, query.species_id)
    if species is None:
        return 0.0, 0
    maps = get_settings().maps
    manifest = tiles.read_manifest(maps, species.slug)
    if manifest is None:
        return 0.0, 0
    week = tiles.find_week(manifest, query.year, query.week)
    if week is None:
        return 0.0, 0
    return tiles.area_mean(maps, manifest, week.tiles, ring)


async def value(db: AsyncSession, zone: Zone, user: User, query: ZoneValueQuery) -> ZoneValueSchema:
    """Der Vorhersagewert einer Zone für eine Art und Woche."""
    ring = GeoPolygon.model_validate_json(zone.polygon).outer_ring()
    mean, points = await _tile_value(db, ring, query)
    stmt = select(Find).where(
        Find.owner_id == user.id,
        Find.species_id == query.species_id,
        Find.deleted_at.is_(None),
    )
    finds = (await db.execute(stmt)).scalars()
    own_finds = sum(1 for found in finds if point_in_polygon((found.lon, found.lat), ring))
    return ZoneValueSchema(
        species_id=query.species_id,
        year=query.year,
        week=query.week,
        area_mean=mean,
        points=points,
        own_finds=own_finds,
    )


@router.get("/zones/{zone_id}/value")
async def get_zone_value(
    db: Db,
    user: CurrentUser,
    zone_id: uuid.UUID,
    query: ZoneValueQueryDep,
) -> Any:  # noqa: ANN401
    """Der Vorhersagewert einer eigenen Zone."""
    zone = await _service(db).read(user, zone_id)
    result = await value(db, zone, user, query)
    return result.dumped()

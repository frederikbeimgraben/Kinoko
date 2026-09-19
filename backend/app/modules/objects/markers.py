"""Endpunkte der Marker."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Query, Response, status

from app.core.auth import CurrentUser, Db
from app.models import Marker, User
from app.modules.objects.repository import MarkerRepository
from app.modules.objects.schemas import MarkerSchema, MarkerWrite
from app.modules.objects.service import ObjectService
from app.modules.objects.visibility import group_of
from app.shared.paging import Page

router = APIRouter(tags=["markers"])


def _service(db: Db) -> ObjectService[Marker]:
    return ObjectService(MarkerRepository(db))


async def _values(db: Db, user: User, body: MarkerWrite) -> dict[str, Any]:
    return {
        "name": body.name,
        "lat": body.lat,
        "lon": body.lon,
        "colour": body.colour,
        "visibility": body.visibility,
        "group_id": await group_of(db, user, body.visibility, body.group_id),
        "note": body.note,
    }


@router.get("/markers")
async def list_markers(
    db: Db,
    user: CurrentUser,
    paging: Page,
    since: Annotated[datetime | None, Query()] = None,
) -> Any:  # noqa: ANN401
    """Eigene Marker, geblättert."""
    service = _service(db)
    if since is None:
        return await service.list(user, paging, MarkerSchema.of)
    return await service.changes_since(user, since, paging, MarkerSchema.of)


@router.post("/markers", status_code=status.HTTP_201_CREATED)
async def create_marker(db: Db, user: CurrentUser, body: MarkerWrite) -> Any:  # noqa: ANN401
    """Legt einen Marker an."""
    entity = Marker(owner_id=user.id, **(await _values(db, user, body)))
    created = await _service(db).create(entity)
    return MarkerSchema.of(created).dumped()


@router.get("/markers/{marker_id}")
async def get_marker(db: Db, user: CurrentUser, marker_id: uuid.UUID) -> Any:  # noqa: ANN401
    """Liest einen eigenen Marker."""
    found = await _service(db).read(user, marker_id)
    return MarkerSchema.of(found).dumped()


@router.put("/markers/{marker_id}")
async def put_marker(
    db: Db,
    user: CurrentUser,
    marker_id: uuid.UUID,
    body: MarkerWrite,
    response: Response,
) -> Any:  # noqa: ANN401
    """Legt den Marker mit dieser Kennung an, oder ersetzt ihn."""
    values = await _values(db, user, body)
    entity, created = await _service(db).update(
        user,
        marker_id,
        lambda: Marker(id=marker_id, owner_id=user.id, **values),
        values,
    )
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return MarkerSchema.of(entity).dumped()


@router.delete("/markers/{marker_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_marker(db: Db, user: CurrentUser, marker_id: uuid.UUID) -> None:
    """Löscht einen eigenen Marker weich."""
    await _service(db).delete(user, marker_id)

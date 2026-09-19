"""Die Endpunkte der Funde. Die Regeln stehen im FindService."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.auth import CurrentUser, CurrentViewer, Db, requires
from app.core.errors import Invalid, Unauthorized
from app.models import Find, User
from app.modules.objects.find_service import FindQuery, FindService
from app.modules.objects.repository import FindRepository
from app.modules.objects.schemas import FindSchema, FindWrite, ReviewBody
from app.modules.objects.service import ObjectService
from app.modules.objects.visibility import group_of
from app.shared.geometry import parse_bbox
from app.shared.paging import Page

router = APIRouter(tags=["finds"])


def _bbox(raw: str | None) -> tuple[float, float, float, float] | None:
    if not raw:
        return None
    box = parse_bbox(raw)
    if box is None:
        raise Invalid(errors=[{"field": "bbox", "code": "bbox"}])
    return box


def find_query(
    *,
    mine: Annotated[bool, Query()] = True,
    species_id: Annotated[uuid.UUID | None, Query(alias="speciesId")] = None,
    bbox: Annotated[str | None, Query()] = None,
    since: Annotated[datetime | None, Query()] = None,
) -> FindQuery:
    """Dependency: die Filter der Fundliste aus der Abfrage."""
    return FindQuery(mine=mine, species_id=species_id, box=_bbox(bbox), since=since)


FindQueryDep = Annotated[FindQuery, Depends(find_query)]


def _objects(db: Db) -> ObjectService[Find]:
    return ObjectService(FindRepository(db))


async def _values(db: Db, user: User, body: FindWrite) -> dict[str, Any]:
    return {
        "species_id": body.species_id,
        "lat": body.lat,
        "lon": body.lon,
        "found_on": body.found_on,
        "count": body.count,
        "for_training": body.for_training,
        "visibility": body.visibility,
        "group_id": await group_of(db, user, body.visibility, body.group_id),
        "note": body.note,
    }


@router.get("/finds")
async def list_finds(
    db: Db,
    viewer: CurrentViewer,
    paging: Page,
    query: FindQueryDep,
) -> Any:  # noqa: ANN401
    """Eigene oder geteilte Funde, geblättert."""
    service = FindService(db)
    if not query.mine:
        return await service.shared(viewer, paging, query)
    if viewer.user is None:
        raise Unauthorized
    return await service.own(viewer.user, paging, query)


@router.post("/finds", status_code=status.HTTP_201_CREATED)
async def create_find(db: Db, user: CurrentUser, body: FindWrite) -> Any:  # noqa: ANN401
    """Legt einen Fund an."""
    entity = Find(owner_id=user.id, **(await _values(db, user, body)))
    created = await _objects(db).create(entity)
    return FindSchema.of(created).dumped()


@router.get("/finds/{find_id}")
async def get_find(db: Db, user: CurrentUser, find_id: uuid.UUID) -> Any:  # noqa: ANN401
    """Liest einen eigenen Fund."""
    found = await _objects(db).read(user, find_id)
    return FindSchema.of(found).dumped()


@router.put("/finds/{find_id}")
async def put_find(
    db: Db,
    user: CurrentUser,
    find_id: uuid.UUID,
    body: FindWrite,
    response: Response,
) -> Any:  # noqa: ANN401
    """Legt den Fund mit dieser Kennung an, oder ersetzt ihn."""
    values = await _values(db, user, body)
    entity, created = await _objects(db).update(
        user,
        find_id,
        lambda: Find(id=find_id, owner_id=user.id, **values),
        values,
    )
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return FindSchema.of(entity).dumped()


@router.delete("/finds/{find_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_find(db: Db, user: CurrentUser, find_id: uuid.UUID) -> None:
    """Löscht einen eigenen Fund weich."""
    await _objects(db).delete(user, find_id)


@router.get("/finds/reviews/open", dependencies=[requires("find.review")])
async def list_open_finds(db: Db, paging: Page) -> Any:  # noqa: ANN401
    """Die offenen Funde, geblättert."""
    return await FindService(db).open_for_review(paging)


@router.post("/finds/{find_id}/review", dependencies=[requires("find.review")])
async def review_find(db: Db, user: CurrentUser, find_id: uuid.UUID, body: ReviewBody) -> Any:  # noqa: ANN401
    """Prüft einen Fund, gleich wem er gehört."""
    found = await FindService(db).review(find_id, user, body.decision)
    return FindSchema.of(found).dumped()


@router.post(
    "/finds/reviews/accept-all",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[requires("find.review")],
)
async def accept_all_open_finds(db: Db, user: CurrentUser) -> None:
    """Nimmt jeden offenen Fund an."""
    await FindService(db).accept_all_open(user)

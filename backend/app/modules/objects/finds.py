"""Endpunkte der Funde, die Prüfung und die Zeilen fürs Training."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Any

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select

from app.core.auth import CurrentUser, CurrentViewer, Db, requires
from app.core.errors import Invalid, Unauthorized
from app.models import Find, Species, now
from app.modules.objects.repository import FindRepository
from app.modules.objects.schemas import FindSchema, FindWrite, ReviewBody
from app.modules.objects.service import ObjectService
from app.shared.enums import Protection, ReviewDecision, ReviewState, Visibility
from app.shared.geometry import parse_bbox
from app.shared.paging import Page, Paging, page, rows, wrap

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

    from sqlalchemy import Select
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.core.auth import Viewer
    from app.models import User


@dataclass(frozen=True, slots=True)
class FindQuery:
    """Die Filter der Fundliste."""

    mine: bool
    species_id: uuid.UUID | None
    box: tuple[float, float, float, float] | None
    since: datetime | None


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

router = APIRouter(tags=["finds"])


def _service(db: Db) -> ObjectService[Find]:
    return ObjectService(FindRepository(db))


def _values(body: FindWrite) -> dict[str, Any]:
    return {
        "species_id": body.species_id,
        "lat": body.lat,
        "lon": body.lon,
        "found_on": body.found_on,
        "count": body.count,
        "for_training": body.for_training,
        "visibility": body.visibility,
        "note": body.note,
    }


def _bbox(raw: str | None) -> tuple[float, float, float, float] | None:
    if raw is None:
        return None
    box = parse_bbox(raw)
    if box is None:
        raise Invalid(errors=[{"field": "bbox", "code": "bbox"}])
    return box


def _filtered(
    query: Select[tuple[Find]],
    species_id: uuid.UUID | None,
    box: tuple[float, float, float, float] | None,
) -> Select[tuple[Find]]:
    if species_id is not None:
        query = query.where(Find.species_id == species_id)
    if box is not None:
        west, south, east, north = box
        query = query.where(Find.lon.between(west, east), Find.lat.between(south, north))
    return query


async def _protections(
    db: AsyncSession,
    species_ids: set[uuid.UUID],
) -> dict[uuid.UUID, Protection]:
    if not species_ids:
        return {}
    query = select(Species.id, Species.protection).where(Species.id.in_(species_ids))
    return {row.id: row.protection for row in await db.execute(query)}


async def _shared_page(
    db: AsyncSession,
    viewer: Viewer,
    paging: Paging,
    query: FindQuery,
) -> dict[str, Any]:
    stmt = select(Find).where(Find.visibility == Visibility.SHARED, Find.deleted_at.is_(None))
    if viewer.user is not None:
        stmt = stmt.where(Find.owner_id != viewer.user.id)
    if query.since is not None:
        stmt = stmt.where(Find.updated_at > query.since)
    found = await rows(db, _filtered(stmt, query.species_id, query.box), paging)
    protections = await _protections(db, {f.species_id for f in found if f.species_id is not None})

    def out(entity: Find) -> FindSchema:
        species_id = entity.species_id
        protection = protections.get(species_id, Protection.NONE) if species_id else Protection.NONE
        return FindSchema.of(entity, coarse=protection != Protection.NONE)

    return wrap(found, paging, out)


async def _own_page(
    db: AsyncSession,
    user: User,
    paging: Paging,
    query: FindQuery,
) -> dict[str, Any]:
    service = _service(db)
    stmt = (
        service.since_query(user, query.since)
        if query.since is not None
        else service.own_query(user)
    )
    out: Callable[[Find], FindSchema] = FindSchema.of
    return await page(db, _filtered(stmt, query.species_id, query.box), paging, out)


@router.get("/finds")
async def list_finds(
    db: Db,
    viewer: CurrentViewer,
    paging: Page,
    query: FindQueryDep,
) -> Any:  # noqa: ANN401
    """Eigene oder geteilte Funde, geblättert."""
    if not query.mine:
        return await _shared_page(db, viewer, paging, query)
    if viewer.user is None:
        raise Unauthorized
    return await _own_page(db, viewer.user, paging, query)


@router.post("/finds", status_code=status.HTTP_201_CREATED)
async def create_find(db: Db, user: CurrentUser, body: FindWrite) -> Any:  # noqa: ANN401
    """Legt einen Fund an."""
    entity = Find(owner_id=user.id, **_values(body))
    created = await _service(db).create(entity)
    return FindSchema.of(created).dumped()


@router.get("/finds/{find_id}")
async def get_find(db: Db, user: CurrentUser, find_id: uuid.UUID) -> Any:  # noqa: ANN401
    """Liest einen eigenen Fund."""
    found = await _service(db).read(user, find_id)
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
    values = _values(body)
    entity, created = await _service(db).update(
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
    await _service(db).delete(user, find_id)


def review(find: Find, reviewer: User, decision: ReviewDecision) -> Find:
    """Setzt die Prüfung eines Fundes."""
    find.review_state = ReviewState(decision.value)
    find.reviewed_by_id = reviewer.id
    find.reviewed_at = now()
    find.updated_at = now()
    return find


@router.post("/finds/{find_id}/review", dependencies=[requires("find.review")])
async def review_find(db: Db, user: CurrentUser, find_id: uuid.UUID, body: ReviewBody) -> Any:  # noqa: ANN401
    """Prüft einen Fund, gleich wem er gehört."""
    repo = FindRepository(db)
    found = await repo.get_or_404(find_id)
    review(found, user, body.decision)
    await repo.commit()
    return FindSchema.of(found).dumped()


@router.post(
    "/finds/reviews/accept-all",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[requires("find.review")],
)
async def accept_all_open_finds(db: Db, user: CurrentUser) -> None:
    """Nimmt jeden offenen Fund an."""
    repo = FindRepository(db)
    query = repo.query().where(Find.review_state == ReviewState.OPEN, Find.deleted_at.is_(None))
    for found in (await db.execute(query)).scalars():
        review(found, user, ReviewDecision.ACCEPTED)
    await repo.commit()


async def training_finds(db: AsyncSession) -> Sequence[Find]:
    """Die geprüften, für das Training freigegebenen Funde mit Art."""
    query = select(Find).where(
        Find.for_training.is_(True),
        Find.review_state == ReviewState.ACCEPTED,
        Find.deleted_at.is_(None),
        Find.species_id.is_not(None),
    )
    return (await db.execute(query)).scalars().all()

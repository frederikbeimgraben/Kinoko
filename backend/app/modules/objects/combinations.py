"""Endpunkte der Kombinationen."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Query, Response, status

from app.core.auth import CurrentUser, Db
from app.core.errors import Invalid
from app.core.settings import get_settings
from app.models import Combination
from app.modules.objects import sources
from app.modules.objects.repository import CombinationRepository
from app.modules.objects.schemas import CombinationSchema, CombinationWrite
from app.modules.objects.service import ObjectService
from app.shared.paging import Page

router = APIRouter(tags=["combinations"])


def _service(db: Db) -> ObjectService[Combination]:
    return ObjectService(CombinationRepository(db))


def check_sources(body: CombinationWrite) -> None:
    """Prüft die Quellen der Faktoren gegen das Manifest."""
    errors = sources.check_sources(get_settings().maps, body.factors)
    if errors:
        raise Invalid(errors=errors)


def _values(body: CombinationWrite) -> dict[str, Any]:
    return {
        "name": body.name,
        "rule": body.rule,
        "factors": json.dumps([factor.model_dump(mode="json") for factor in body.factors]),
    }


@router.get("/combinations")
async def list_combinations(
    db: Db,
    user: CurrentUser,
    paging: Page,
    since: Annotated[datetime | None, Query()] = None,
) -> Any:  # noqa: ANN401
    """Eigene Kombinationen, geblättert."""
    service = _service(db)
    if since is None:
        return await service.list(user, paging, CombinationSchema.of)
    return await service.changes_since(user, since, paging, CombinationSchema.of)


@router.post("/combinations", status_code=status.HTTP_201_CREATED)
async def create_combination(db: Db, user: CurrentUser, body: CombinationWrite) -> Any:  # noqa: ANN401
    """Legt eine Kombination an."""
    check_sources(body)
    entity = Combination(owner_id=user.id, **_values(body))
    created = await _service(db).create(entity)
    return CombinationSchema.of(created).dumped()


@router.get("/combinations/{combination_id}")
async def get_combination(db: Db, user: CurrentUser, combination_id: uuid.UUID) -> Any:  # noqa: ANN401
    """Liest eine eigene Kombination."""
    found = await _service(db).read(user, combination_id)
    return CombinationSchema.of(found).dumped()


@router.put("/combinations/{combination_id}")
async def put_combination(
    db: Db,
    user: CurrentUser,
    combination_id: uuid.UUID,
    body: CombinationWrite,
    response: Response,
) -> Any:  # noqa: ANN401
    """Legt die Kombination mit dieser Kennung an, oder ersetzt sie."""
    check_sources(body)
    values = _values(body)
    entity, created = await _service(db).update(
        user,
        combination_id,
        lambda: Combination(id=combination_id, owner_id=user.id, **values),
        values,
    )
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return CombinationSchema.of(entity).dumped()


@router.delete("/combinations/{combination_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_combination(db: Db, user: CurrentUser, combination_id: uuid.UUID) -> None:
    """Löscht eine eigene Kombination weich."""
    await _service(db).delete(user, combination_id)

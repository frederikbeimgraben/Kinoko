"""Die Endpunkte des Textkatalogs."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Header, Query, Response, status

from app.core.auth import CurrentUser, Db, requires
from app.modules.texts import service
from app.modules.texts.schemas import TextWrite

router = APIRouter(tags=["texts"])


@router.get("/texts")
async def list_texts(
    db: Db,
    response: Response,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Any:  # noqa: ANN401
    """Liefert den Katalog, mit ETag."""
    body = service.catalogue(await service.entries(db))
    tag = service.fingerprint(body)
    response.headers["ETag"] = tag
    if if_none_match == tag:
        response.status_code = status.HTTP_304_NOT_MODIFIED
        return None
    return body


@router.put("/texts/{key}", dependencies=[requires("text.edit")])
async def put_text(db: Db, user: CurrentUser, key: str, body: TextWrite) -> Any:  # noqa: ANN401
    """Setzt einen Text."""
    return await service.change(db, key, body.locale, body.value, user.id)


@router.delete(
    "/texts/{key}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[requires("text.edit")],
)
async def reset_text(db: Db, key: str, locale: Annotated[str, Query()]) -> None:
    """Setzt einen Text auf die Vorgabe zurück."""
    await service.reset(db, key, locale)

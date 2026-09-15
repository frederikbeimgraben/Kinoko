"""Der ganze Katalog in einem Zug, mit ETag."""

from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Annotated, Any, Final

from fastapi import APIRouter, Header, Response, status
from sqlalchemy import func, select

from app.core.auth import Db
from app.models import Photo
from app.modules.catalog import colours
from app.modules.catalog.facets import FacetService
from app.modules.catalog.loader import load_many_with_facets
from app.modules.catalog.repository import SpeciesRepository
from app.modules.catalog.schemas import SpeciesBundle, StandardColourEntry
from app.shared.enums import PhotoState

if TYPE_CHECKING:
    from collections.abc import Sequence
    from datetime import datetime

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import Species

router = APIRouter(tags=["species"])

#: Erhöht sich, wenn sich die Antwortform ändert. Verdrängt alte Bündel im Cache.
BUNDLE_SHAPE: Final = 2


async def _photo_stamp(db: AsyncSession) -> tuple[datetime | None, int]:
    """Liest den jüngsten Zeitpunkt und die Zahl der freigegebenen Fotos."""
    query = select(func.max(Photo.updated_at), func.count(Photo.id)).where(
        Photo.state == PhotoState.APPROVED
    )
    stamp, count = (await db.execute(query)).one()
    return stamp, count


def etag_of(rows: Sequence[Species], photo_stamp: datetime | None, photo_count: int) -> str:
    """Baut den ETag aus Artenstand, Titelbildstand und der Antwortform."""
    species_stamp = max((row.updated_at for row in rows), default=None)
    raw = (
        f"{BUNDLE_SHAPE}:{len(rows)}:{species_stamp.isoformat() if species_stamp else ''}"
        f":{photo_count}:{photo_stamp.isoformat() if photo_stamp else ''}"
    )
    return f'W/"{hashlib.sha256(raw.encode()).hexdigest()[:16]}"'


@router.get("/species/bundle")
async def get_species_bundle(
    db: Db,
    response: Response,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Any:  # noqa: ANN401
    """Liefert den ganzen Katalog, mit ETag."""
    rows = await SpeciesRepository(db).all()
    photo_stamp, photo_count = await _photo_stamp(db)
    tag = etag_of(rows, photo_stamp, photo_count)
    response.headers["ETag"] = tag
    if if_none_match == tag:
        response.status_code = status.HTTP_304_NOT_MODIFIED
        return None
    items, matchables = await load_many_with_facets(db, rows)
    body = SpeciesBundle(
        items=items,
        standard_colours=[StandardColourEntry(**entry) for entry in colours.palette()],
        facets=FacetService().catalogue(matchables),
    )
    return body.dumped()

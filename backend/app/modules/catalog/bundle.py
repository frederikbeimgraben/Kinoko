"""Der ganze Katalog in einem Zug, mit ETag."""

from __future__ import annotations

import hashlib
import json
from typing import TYPE_CHECKING, Annotated, Any, Final

from fastapi import APIRouter, Header, Response, status
from sqlalchemy import func, select

from app.core.auth import Db
from app.models import Photo
from app.modules.catalog import colours
from app.modules.catalog.bundle_cache import BundleCache
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

#: Der Katalog kostet je Bau über eine Sekunde. Er liegt darum fertig bereit.
CACHE: Final = BundleCache()


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


async def _build(db: AsyncSession, rows: Sequence[Species]) -> bytes:
    """Baut den Katalog und gibt ihn als fertigen JSON-Körper zurück."""
    items, matchables = await load_many_with_facets(db, rows)
    body = SpeciesBundle(
        items=items,
        standard_colours=[StandardColourEntry(**entry) for entry in colours.palette()],
        facets=FacetService().catalogue(matchables),
    )
    return json.dumps(body.dumped(), ensure_ascii=False, separators=(",", ":")).encode()


async def warm(db: AsyncSession) -> None:
    """Baut den Katalog beim Start, damit die erste Anfrage ihn vorfindet."""
    rows = await SpeciesRepository(db).all()
    photo_stamp, photo_count = await _photo_stamp(db)
    tag = etag_of(rows, photo_stamp, photo_count)
    await CACHE.body(tag, lambda: _build(db, rows))


@router.get("/species/bundle")
async def get_species_bundle(
    db: Db,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Any:  # noqa: ANN401
    """Liefert den ganzen Katalog, mit ETag."""
    rows = await SpeciesRepository(db).all()
    photo_stamp, photo_count = await _photo_stamp(db)
    tag = etag_of(rows, photo_stamp, photo_count)
    if if_none_match == tag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": tag})
    body = await CACHE.body(tag, lambda: _build(db, rows))
    return Response(content=body, media_type="application/json", headers={"ETag": tag})

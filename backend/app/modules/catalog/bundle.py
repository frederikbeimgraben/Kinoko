"""Der ganze Katalog in einem Zug, mit ETag."""

from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Annotated, Any

from fastapi import APIRouter, Header, Response, status

from app.core.auth import Db
from app.modules.catalog import colours
from app.modules.catalog.facets import FacetService
from app.modules.catalog.loader import load_many_with_facets
from app.modules.catalog.repository import SpeciesRepository
from app.modules.catalog.schemas import SpeciesBundle, StandardColourEntry

if TYPE_CHECKING:
    from collections.abc import Sequence

    from app.models import Species

router = APIRouter(tags=["species"])


def etag_of(rows: Sequence[Species]) -> str:
    """Baut den ETag aus der jüngsten Änderung und der Artenzahl."""
    stamp = max((row.updated_at for row in rows), default=None)
    raw = f"{len(rows)}:{stamp.isoformat() if stamp else ''}"
    return f'W/"{hashlib.sha256(raw.encode()).hexdigest()[:16]}"'


@router.get("/species/bundle")
async def get_species_bundle(
    db: Db,
    response: Response,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Any:  # noqa: ANN401
    """Liefert den ganzen Katalog, mit ETag."""
    rows = await SpeciesRepository(db).all()
    tag = etag_of(rows)
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

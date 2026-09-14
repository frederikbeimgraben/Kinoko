"""Die Endpunkte der Art. Die Regeln stehen im SpeciesService."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Query, Request, status
from pydantic import Field

from app.core.auth import CurrentUser, Db, requires
from app.modules.catalog.query import build_selection
from app.modules.catalog.schemas import Species, SpeciesCounts, SpeciesWrite
from app.modules.catalog.service import ForecastWrite, SpeciesService
from app.shared.enums import CapShape, Edibility, HymeniumType
from app.shared.paging import SmallPage

router = APIRouter(tags=["species"])


@router.get("/species")
async def list_species(  # noqa: PLR0913, PLR0917
    db: Db,
    request: Request,
    paging: SmallPage,
    q: Annotated[str | None, Query()] = None,
    taxon_id: Annotated[uuid.UUID | None, Query(alias="taxonId")] = None,
    edibility: Annotated[list[Edibility] | None, Query(alias="edibility[]")] = None,
    hymenium: Annotated[list[HymeniumType] | None, Query(alias="hymenium[]")] = None,
    cap_shape: Annotated[list[CapShape] | None, Query(alias="capShape[]")] = None,
    terms: Annotated[list[uuid.UUID] | None, Query(alias="terms[]")] = None,
    months: Annotated[
        list[Annotated[int, Field(ge=1, le=12)]] | None, Query(alias="months[]")
    ] = None,
) -> Any:  # noqa: ANN401
    """Blättert die Artenliste."""
    selection = build_selection(
        edibility=edibility or [],
        hymenium=hymenium or [],
        cap_shape=cap_shape or [],
        terms=terms or [],
        months=months or [],
        params=request.query_params,
    )
    return await SpeciesService(db).listing(
        q=q, taxon_id=taxon_id, selection=selection, paging=paging
    )


@router.get("/species/{slug}")
async def get_species(db: Db, slug: str) -> Species:
    """Liest das Profil einer Art."""
    return await SpeciesService(db).profile(slug)


@router.post(
    "/species", status_code=status.HTTP_201_CREATED, dependencies=[requires("species.edit")]
)
async def create_species(db: Db, user: CurrentUser, body: SpeciesWrite) -> Species:
    """Legt eine Art an."""
    return await SpeciesService(db).create(body, user.id)


@router.put("/species/{slug}", dependencies=[requires("species.edit")])
async def replace_species(db: Db, user: CurrentUser, slug: str, body: SpeciesWrite) -> Species:
    """Ersetzt eine Art."""
    return await SpeciesService(db).update(slug, body, user.id)


@router.delete(
    "/species/{slug}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[requires("species.edit")],
)
async def delete_species(db: Db, slug: str) -> None:
    """Löscht eine Art."""
    await SpeciesService(db).delete(slug)


@router.put("/species/{slug}/forecast", dependencies=[requires("species.edit")])
async def set_species_forecast(db: Db, slug: str, body: ForecastWrite) -> Species:
    """Setzt die Prognose einer Art."""
    return await SpeciesService(db).set_forecast(slug, enabled=body.enabled)


@router.get("/species/{slug}/counts", dependencies=[requires("species.edit")])
async def get_species_counts(db: Db, slug: str) -> SpeciesCounts:
    """Liest die Zahlen einer Art zum Pflegen."""
    return await SpeciesService(db).counts(slug)

"""Der Endpunkt der Art: Liste, Profil, Schreiben, Prognose, Zahlen."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Annotated, Any

from fastapi import APIRouter, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.core.auth import CurrentUser, Db, requires
from app.core.errors import Conflict
from app.models import Find, Photo, PipelineRun, PipelineRunSpecies
from app.modules.catalog.children import load_children
from app.modules.catalog.facets import FacetService
from app.modules.catalog.loader import build_facets, load_one, summary_of
from app.modules.catalog.query import build_selection
from app.modules.catalog.repository import SpeciesRepository
from app.modules.catalog.schemas import Species, SpeciesCounts, SpeciesWrite
from app.modules.catalog.taxonomy import subtree_ids
from app.shared.enums import CapShape, Edibility, HymeniumType
from app.shared.paging import SmallPage, wrap

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import Species as SpeciesRow
    from app.modules.catalog.facets import Selection
    from app.shared.paging import Paging

router = APIRouter(tags=["species"])
FACETS = FacetService()


class ForecastWrite(BaseModel):
    """Der Schalter der Prognose."""

    enabled: bool


class SpeciesService:
    """Listet, liest und schreibt Arten."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = SpeciesRepository(db)

    async def listing(
        self,
        *,
        q: str | None,
        taxon_id: uuid.UUID | None,
        selection: Selection,
        paging: Paging,
    ) -> dict[str, Any]:
        """Blättert die Artenliste nach Suche, Achsen und Farbe/Maß."""
        taxon_ids = await subtree_ids(self.db, taxon_id) if taxon_id is not None else None
        candidates = await self.repo.search(
            q=q,
            taxon_ids=taxon_ids,
            edibility=selection.edibility,
            hymenium=selection.hymenium,
            cap_shape=selection.cap_shape,
            term_ids=selection.terms,
        )
        child = await load_children(self.db, [c.id for c in candidates])
        matched = [c for c in candidates if FACETS.match(build_facets(c, child), selection)]
        window = matched[paging.offset : paging.offset + paging.limit + 1]
        return wrap(window, paging, lambda c: summary_of(c, child.lead_photos.get(c.id)))

    async def profile(self, slug: str) -> Species:
        """Liest das volle Profil einer Art."""
        entity = await self.repo.by_slug(slug)
        return await load_one(self.db, entity)

    async def create(self, body: SpeciesWrite, user_id: uuid.UUID) -> Species:
        """Legt eine Art an."""
        entity = await self.repo.create(body, user_id)
        return await load_one(self.db, entity)

    async def update(self, slug: str, body: SpeciesWrite, user_id: uuid.UUID) -> Species:
        """Ersetzt eine Art samt Kindzeilen."""
        entity = await self.repo.by_slug(slug)
        entity = await self.repo.replace(entity, body, user_id)
        return await load_one(self.db, entity)

    async def delete(self, slug: str) -> None:
        """Löscht eine Art, wenn sie unbenutzt ist."""
        entity = await self.repo.by_slug(slug)
        await self.guard_in_use(entity)
        await self.repo.delete(entity)
        await self.repo.commit()

    async def guard_in_use(self, entity: SpeciesRow) -> None:
        """Verweigert das Löschen einer Art mit Funden oder Fotos."""
        finds = await self.db.execute(
            select(func.count()).where(Find.species_id == entity.id, Find.deleted_at.is_(None)),
        )
        if finds.scalar_one() > 0:
            raise Conflict("in_use")
        photos = await self.db.execute(select(func.count()).where(Photo.species_id == entity.id))
        if photos.scalar_one() > 0:
            raise Conflict("in_use")

    async def set_forecast(self, slug: str, *, enabled: bool) -> Species:
        """Setzt die Prognose einer Art."""
        entity = await self.repo.by_slug(slug)
        entity.forecast_enabled = enabled
        await self.repo.commit()
        return await load_one(self.db, entity)

    async def counts(self, slug: str) -> SpeciesCounts:
        """Liest die Zahlen einer Art zum Pflegen."""
        entity = await self.repo.by_slug(slug)
        records = await self.db.execute(
            select(PipelineRunSpecies.record_count)
            .join(PipelineRun, PipelineRun.id == PipelineRunSpecies.run_id)
            .where(PipelineRunSpecies.species_id == entity.id)
            .order_by(PipelineRun.queued_at.desc())
            .limit(1),
        )
        finds = await self.db.execute(
            select(func.count()).where(Find.species_id == entity.id, Find.deleted_at.is_(None)),
        )
        photos = await self.db.execute(select(func.count()).where(Photo.species_id == entity.id))
        return SpeciesCounts(
            records=records.scalars().first() or 0,
            finds=finds.scalar_one(),
            photos=photos.scalar_one(),
        )


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

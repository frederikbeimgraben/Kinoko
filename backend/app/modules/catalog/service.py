"""Der Dienst der Arten: listen, lesen, schreiben, zählen."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.errors import Conflict
from app.models import Find, Photo, PipelineRun, PipelineRunSpecies
from app.models import Species as SpeciesTable
from app.modules.catalog.children import load_children
from app.modules.catalog.facets import FacetService
from app.modules.catalog.loader import build_facets, load_one, summary_of
from app.modules.catalog.taxon_names import taxon_names
from app.modules.catalog.repository import SpeciesRepository
from app.modules.catalog.schemas import Species, SpeciesCounts, SpeciesWrite
from app.modules.catalog.taxonomy import subtree_ids
from app.shared.enums import RunState
from app.shared.paging import wrap

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import InstrumentedAttribute
    from sqlalchemy.sql.elements import ColumnElement

    from app.modules.catalog.facets import Selection
    from app.shared.paging import Paging

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
        names = await taxon_names(self.db)
        return wrap(window, paging, lambda c: summary_of(c, child.lead_photos.get(c.id), names.of(c)))

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

    async def guard_in_use(self, entity: SpeciesTable) -> None:
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
        return (await self.counts_for([entity.id]))[entity.id]

    async def counts_all(self, paging: Paging) -> dict[uuid.UUID, SpeciesCounts]:
        """Liest die Zahlen einer Seite der Artenliste."""
        found = await self.repo.list(self.repo.query().order_by(SpeciesTable.name), paging)
        return await self.counts_for([row.id for row in found[: paging.limit]])

    async def counts_for(self, ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, SpeciesCounts]:
        """Datenbestand, Funde und Bilder je Art."""
        records = await self.records_of(ids)
        finds = await self.tally(Find.species_id, ids, Find.deleted_at.is_(None))
        photos = await self.tally(Photo.species_id, ids)
        return {
            key: SpeciesCounts(
                records=records.get(key, 0),
                finds=finds.get(key, 0),
                photos=photos.get(key, 0),
            )
            for key in ids
        }

    async def records_of(self, ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
        """Der Datenbestand je Art aus der jüngsten fertigen Zeile."""
        query = (
            select(PipelineRunSpecies.species_id, PipelineRunSpecies.record_count)
            .join(PipelineRun, PipelineRun.id == PipelineRunSpecies.run_id)
            .where(
                PipelineRunSpecies.species_id.in_(ids),
                PipelineRunSpecies.state == RunState.FINISHED,
            )
            .order_by(PipelineRun.queued_at)
        )
        return {row[0]: row[1] for row in await self.db.execute(query)}

    async def tally(
        self,
        column: InstrumentedAttribute[uuid.UUID | None],
        ids: Sequence[uuid.UUID],
        *where: ColumnElement[bool],
    ) -> dict[uuid.UUID, int]:
        """Zählt Zeilen einer Tabelle je Art."""
        query = select(column, func.count()).where(column.in_(ids), *where).group_by(column)
        return {row[0]: row[1] for row in await self.db.execute(query)}

"""Die Taxonseite: Weg, Nachbarn, Kinder und Arten, gezielt geladen."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.auth import Db
from app.models import Species, Taxon
from app.modules.catalog.children import load_children
from app.modules.catalog.loader import summary_of
from app.modules.catalog.schemas import TaxonChild, TaxonPage, TaxonStep
from app.shared.enums import TaxonRank
from app.shared.repository import Repository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["taxa"])


async def subtree_ids(db: AsyncSession, root_id: uuid.UUID) -> set[uuid.UUID]:
    """Sammelt ein Taxon und alle Nachfahren, Ebene für Ebene."""
    found = {root_id}
    frontier = {root_id}
    while frontier:
        rows = (await db.execute(select(Taxon.id).where(Taxon.parent_id.in_(frontier)))).scalars()
        frontier = set(rows) - found
        found |= frontier
    return found


async def species_count_in(db: AsyncSession, taxon_ids: set[uuid.UUID]) -> int:
    """Zählt Arten, deren Taxon in der gegebenen Menge liegt."""
    if not taxon_ids:
        return 0
    result = await db.execute(select(func.count()).where(Species.taxon_id.in_(taxon_ids)))
    return result.scalar_one()


def _step(taxon: Taxon) -> TaxonStep:
    """Baut einen Knoten der Einordnung, kurz."""
    return TaxonStep(id=taxon.id, slug=taxon.slug, name=taxon.name, rank=taxon.rank)


class TaxonomyService:
    """Liest die Seite eines Taxons, ohne die ganze Tabelle zu laden."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = Repository(db, Taxon)

    async def page(self, rank: TaxonRank, slug: str) -> TaxonPage:
        """Baut die Seite eines Taxons."""
        taxon = await self.repo.one_or_404(Taxon.rank == rank, Taxon.slug == slug)
        path = await self._path(taxon)
        siblings = await self._siblings(taxon)
        children = await self._children(taxon)
        ids = await subtree_ids(self.db, taxon.id)
        species_rows = list(
            (
                await self.db.execute(
                    select(Species).where(Species.taxon_id.in_(ids)).order_by(Species.name)
                )
            ).scalars(),
        )
        child = await load_children(self.db, [s.id for s in species_rows])
        species = [summary_of(s, child.lead_photos.get(s.id)) for s in species_rows]
        return TaxonPage(
            id=taxon.id,
            slug=taxon.slug,
            name=taxon.name,
            rank=taxon.rank,
            description=taxon.description,
            path=path,
            siblings=siblings,
            children=children,
            species=species,
            species_count=len(species_rows),
        )

    async def _path(self, taxon: Taxon) -> list[TaxonStep]:
        chain: list[Taxon] = []
        current = taxon
        while current.parent_id is not None:
            parent = await self.db.get(Taxon, current.parent_id)
            if parent is None:
                break
            chain.append(parent)
            current = parent
        chain.reverse()
        return [_step(t) for t in chain]

    async def _siblings(self, taxon: Taxon) -> list[TaxonStep]:
        query = select(Taxon).where(Taxon.parent_id == taxon.parent_id, Taxon.id != taxon.id)
        rows = (await self.db.execute(query)).scalars()
        return [_step(t) for t in rows]

    async def _children(self, taxon: Taxon) -> list[TaxonChild]:
        rows = list(
            (await self.db.execute(select(Taxon).where(Taxon.parent_id == taxon.id))).scalars()
        )
        result: list[TaxonChild] = []
        for row in rows:
            row_ids = await subtree_ids(self.db, row.id)
            count = await species_count_in(self.db, row_ids)
            result.append(
                TaxonChild(
                    id=row.id, slug=row.slug, name=row.name, rank=row.rank, species_count=count
                ),
            )
        return result


@router.get("/taxa/{rank}/{slug}")
async def get_taxon_page(db: Db, rank: TaxonRank, slug: str) -> TaxonPage:
    """Liest die Seite eines Taxons."""
    return await TaxonomyService(db).page(rank, slug)

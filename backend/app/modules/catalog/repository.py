"""Lesen und Schreiben der Art. Die Kindzeilen liest ``children``, schreibt ``write``."""

from __future__ import annotations

import re
import unicodedata
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import func, or_, select

from app.core.errors import Conflict
from app.models import Species, SpeciesName, SpeciesTerm, now
from app.modules.catalog import write as species_write
from app.shared.repository import Repository

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.modules.catalog.schemas import SpeciesWrite
    from app.shared.enums import CapShape, Edibility, HymeniumType

UMLAUTS: dict[str, str] = {"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"}
NON_WORD: re.Pattern[str] = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    """Macht aus einem lateinischen Namen einen Slug, Umlaute umgeschrieben."""
    lowered = value.lower()
    for umlaut, plain in UMLAUTS.items():
        lowered = lowered.replace(umlaut, plain)
    ascii_form = unicodedata.normalize("NFKD", lowered).encode("ascii", "ignore").decode()
    return NON_WORD.sub("-", ascii_form).strip("-")


class SpeciesRepository(Repository[Species]):
    """Der Zugang zur Tabelle ``species``."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Species)

    async def by_slug(self, slug: str) -> Species:
        """Liest eine Art über ihren Slug, sonst 404."""
        return await self.one_or_404(Species.slug == slug)

    async def slug_taken(self, slug: str) -> bool:
        """Sagt, ob ein Slug schon vergeben ist."""
        query = select(Species.id).where(Species.slug == slug)
        return (await self.db.execute(query)).first() is not None

    async def all(self) -> Sequence[Species]:
        """Liest alle Arten, nach Namen geordnet."""
        return list((await self.db.execute(self.query().order_by(Species.name))).scalars())

    async def search(  # noqa: PLR0913
        self,
        *,
        q: str | None,
        taxon_ids: set[uuid.UUID] | None,
        edibility: frozenset[Edibility],
        hymenium: frozenset[HymeniumType],
        cap_shape: frozenset[CapShape],
        term_ids: frozenset[uuid.UUID],
    ) -> Sequence[Species]:
        """Liest Arten nach den achsenfesten Kriterien, nach Namen geordnet."""
        query = self.query().order_by(Species.name)
        if q:
            like = f"%{q}%"
            named = select(SpeciesName.species_id).where(SpeciesName.name.ilike(like))
            query = query.where(
                or_(
                    Species.name.ilike(like), Species.latin_name.ilike(like), Species.id.in_(named)
                ),
            )
        if taxon_ids is not None:
            query = query.where(Species.taxon_id.in_(taxon_ids))
        if edibility:
            query = query.where(Species.edibility.in_(edibility))
        if hymenium:
            query = query.where(Species.hymenium_type.in_(hymenium))
        if cap_shape:
            query = query.where(
                or_(Species.cap_shape_young.in_(cap_shape), Species.cap_shape_old.in_(cap_shape)),
            )
        if term_ids:
            has_all = (
                select(SpeciesTerm.species_id)
                .where(SpeciesTerm.term_id.in_(term_ids))
                .group_by(SpeciesTerm.species_id)
                .having(func.count(func.distinct(SpeciesTerm.term_id)) == len(term_ids))
            )
            query = query.where(Species.id.in_(has_all))
        return list((await self.db.execute(query)).scalars())

    async def create(self, body: SpeciesWrite, user_id: uuid.UUID) -> Species:
        """Legt eine Art an, Slug aus dem lateinischen Namen."""
        slug = slugify(body.scientific_name)
        if await self.slug_taken(slug):
            raise Conflict("slug_taken")
        entity = Species(id=uuid.uuid4(), slug=slug, updated_by_id=user_id)
        _assign(entity, body)
        self.add(entity)
        await self.db.flush()
        await species_write.replace_children(self.db, entity.id, body)
        await self.commit()
        await self.db.refresh(entity)
        return entity

    async def replace(self, entity: Species, body: SpeciesWrite, user_id: uuid.UUID) -> Species:
        """Ersetzt eine Art samt ihren Kindzeilen."""
        _assign(entity, body)
        entity.updated_at = now()
        entity.updated_by_id = user_id
        await species_write.replace_children(self.db, entity.id, body)
        await self.commit()
        await self.db.refresh(entity)
        return entity


def _assign(entity: Species, body: SpeciesWrite) -> None:
    """Setzt die Kopffelder der Art aus dem Schreibkörper."""
    entity.name = body.name
    entity.latin_name = body.scientific_name
    entity.taxon_id = body.taxon_id
    entity.group_key = body.group
    entity.edibility = body.edibility
    entity.marketable = body.marketable
    entity.frequency = body.frequency
    entity.red_list = body.red_list
    entity.description = body.description
    entity.edibility_note = body.edibility_note
    entity.protection = body.protection
    entity.protection_note = body.protection_note
    entity.period_start_month = body.period_start_month
    entity.period_end_month = body.period_end_month
    entity.period_peak_month = body.period_peak_month
    entity.smell_text = body.smell_text
    entity.taste_text = body.taste_text
    entity.hymenium_type = body.hymenium_type
    entity.gill_attachment = body.gill_attachment
    entity.gill_spacing = body.gill_spacing
    entity.gill_edge = body.gill_edge
    entity.cap_shape_young = body.cap_shape_young
    entity.cap_shape_old = body.cap_shape_old

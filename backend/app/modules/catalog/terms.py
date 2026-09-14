"""Die Begriffe des Katalogs: lesen, anlegen, ändern, verschmelzen."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Annotated, Any

from fastapi import APIRouter, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.auth import Db, requires
from app.core.errors import Conflict, Invalid
from app.models import SpeciesColourChangeTrigger, SpeciesTerm
from app.models import Term as TermRow
from app.modules.catalog.schemas import Term, TermCreate, TermUpdate
from app.shared.enums import TermKind
from app.shared.repository import Repository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["terms"])


class MergeWrite(BaseModel):
    """Das Ziel eines Verschmelzens."""

    into: uuid.UUID


def _out(entity: TermRow) -> Term:
    """Baut das Schema eines Begriffs."""
    return Term(
        id=entity.id,
        kind=entity.kind,
        group=entity.group_key,
        slug=entity.slug,
        name=entity.name,
        position=entity.position,
    )


class TermService:
    """Liest und schreibt die Begriffe des Katalogs."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = Repository(db, TermRow)

    async def catalogue(self, kind: TermKind | None) -> list[Term]:
        """Liest die Begriffe, nach Position und Namen geordnet."""
        query = self.repo.query()
        if kind is not None:
            query = query.where(TermRow.kind == kind)
        query = query.order_by(TermRow.position, TermRow.name)
        rows = (await self.db.execute(query)).scalars()
        return [_out(row) for row in rows]

    async def create(self, body: TermCreate) -> Term:
        """Legt einen Begriff an."""
        taken = await self.db.execute(
            select(TermRow.id).where(TermRow.kind == body.kind, TermRow.slug == body.slug),
        )
        if taken.first() is not None:
            raise Conflict("slug_taken")
        entity = TermRow(
            id=uuid.uuid4(),
            kind=body.kind,
            group_key=body.group,
            slug=body.slug,
            name=body.name,
            position=body.position,
        )
        self.repo.add(entity)
        await self.repo.commit()
        return _out(entity)

    async def rename(self, term_id: uuid.UUID, body: TermUpdate) -> Term:
        """Ändert Name, Gruppe oder Position eines Begriffs."""
        entity = await self.repo.get_or_404(term_id)
        updates = body.model_dump(exclude_unset=True)
        if "group" in updates:
            entity.group_key = updates.pop("group")
        for field, value in updates.items():
            setattr(entity, field, value)
        await self.repo.commit()
        return _out(entity)

    async def merge(self, term_id: uuid.UUID, into_id: uuid.UUID) -> None:
        """Hängt jede Verwendung eines Begriffs auf ein Zielwort um."""
        if term_id == into_id:
            raise Invalid(errors=[{"field": "into", "code": "self_merge"}])
        entity = await self.repo.get_or_404(term_id)
        await self.repo.get_or_404(into_id)
        await self._move_terms(entity.id, into_id)
        await self._move_triggers(entity.id, into_id)
        await self.db.delete(entity)
        await self.repo.commit()

    async def _move_terms(self, term_id: uuid.UUID, into_id: uuid.UUID) -> None:
        holders = set(
            (
                await self.db.execute(
                    select(SpeciesTerm.species_id).where(SpeciesTerm.term_id == into_id)
                )
            ).scalars(),
        )
        rows = (
            await self.db.execute(select(SpeciesTerm).where(SpeciesTerm.term_id == term_id))
        ).scalars()
        for row in rows:
            if row.species_id in holders:
                await self.db.delete(row)
            else:
                row.term_id = into_id

    async def _move_triggers(self, term_id: uuid.UUID, into_id: uuid.UUID) -> None:
        query = select(
            SpeciesColourChangeTrigger.species_id, SpeciesColourChangeTrigger.position
        ).where(
            SpeciesColourChangeTrigger.term_id == into_id,
        )
        holders = set((await self.db.execute(query)).all())
        rows = (
            await self.db.execute(
                select(SpeciesColourChangeTrigger).where(
                    SpeciesColourChangeTrigger.term_id == term_id
                )
            )
        ).scalars()
        for row in rows:
            if (row.species_id, row.position) in holders:
                await self.db.delete(row)
            else:
                row.term_id = into_id


@router.get("/terms")
async def list_terms(db: Db, kind: Annotated[TermKind | None, Query()] = None) -> Any:  # noqa: ANN401
    """Liest den Begriffskatalog."""
    items = await TermService(db).catalogue(kind)
    return {"items": [item.dumped() for item in items]}


@router.post("/terms", status_code=status.HTTP_201_CREATED, dependencies=[requires("species.edit")])
async def create_term(db: Db, body: TermCreate) -> Term:
    """Legt einen Begriff an."""
    return await TermService(db).create(body)


@router.patch("/terms/{term_id}", dependencies=[requires("species.edit")])
async def update_term(db: Db, term_id: uuid.UUID, body: TermUpdate) -> Term:
    """Ändert einen Begriff."""
    return await TermService(db).rename(term_id, body)


@router.post(
    "/terms/{term_id}/merge",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[requires("species.edit")],
)
async def merge_term(db: Db, term_id: uuid.UUID, body: MergeWrite) -> None:
    """Verschmilzt einen Begriff in ein Zielwort."""
    await TermService(db).merge(term_id, body.into)

"""Die Endpunkte des Glossars."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Path, status
from pydantic import Field
from sqlalchemy import select

from app.core.auth import CurrentUser, Db, requires
from app.core.errors import Invalid, NotFound
from app.models import GlossaryEntry
from app.shared.schema import Schema, Timestamp

router = APIRouter(tags=["glossary"])

EntryId = Annotated[uuid.UUID, Path(alias="id")]


class GlossaryEntryWrite(Schema):
    """Ein geschriebener Begriff."""

    term: str = Field(min_length=1, max_length=80)
    definition: str = Field(min_length=1, max_length=600)


class GlossarySchema(Schema):
    """Ein Begriff nach außen."""

    id: uuid.UUID
    term: str
    definition: str
    updated_by_name: str | None
    updated_at: Timestamp

    @classmethod
    def of(cls, row: GlossaryEntry) -> GlossarySchema:
        """Baut das Schema aus einer Zeile."""
        return cls(
            id=row.id,
            term=row.term,
            definition=row.definition,
            updated_by_name=row.updated_by_name,
            updated_at=row.updated_at,
        )


async def taken(db: Db, term: str, without: uuid.UUID | None = None) -> bool:
    """Sagt, ob ein anderer Eintrag denselben Begriff trägt."""
    query = select(GlossaryEntry.id).where(GlossaryEntry.term == term)
    if without is not None:
        query = query.where(GlossaryEntry.id != without)
    return (await db.execute(query)).first() is not None


@router.get("/glossary")
async def list_glossary(db: Db) -> Any:  # noqa: ANN401
    """Alle Begriffe, nach Begriff geordnet."""
    query = select(GlossaryEntry).order_by(GlossaryEntry.term)
    found = (await db.execute(query)).scalars()
    return {"items": [GlossarySchema.of(row).dumped() for row in found]}


@router.post(
    "/glossary",
    status_code=status.HTTP_201_CREATED,
    dependencies=[requires("text.edit")],
)
async def create_glossary_entry(db: Db, user: CurrentUser, body: GlossaryEntryWrite) -> Any:  # noqa: ANN401
    """Legt einen Begriff an."""
    if await taken(db, body.term):
        raise Invalid(errors=[{"field": "term", "code": "taken"}])
    made = GlossaryEntry(term=body.term, definition=body.definition, updated_by_id=user.id)
    db.add(made)
    await db.commit()
    await db.refresh(made)
    return GlossarySchema.of(made).dumped()


@router.put("/glossary/{id}", dependencies=[requires("text.edit")])  # noqa: FAST003
async def update_glossary_entry(
    db: Db,
    user: CurrentUser,
    entry_id: EntryId,
    body: GlossaryEntryWrite,
) -> Any:  # noqa: ANN401
    """Ändert einen Begriff."""
    found = await db.get(GlossaryEntry, entry_id)
    if found is None:
        raise NotFound
    if await taken(db, body.term, entry_id):
        raise Invalid(errors=[{"field": "term", "code": "taken"}])
    found.term = body.term
    found.definition = body.definition
    found.updated_by_id = user.id
    await db.commit()
    await db.refresh(found)
    return GlossarySchema.of(found).dumped()


@router.delete(
    "/glossary/{id}",  # noqa: FAST003
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[requires("text.edit")],
)
async def delete_glossary_entry(db: Db, entry_id: EntryId) -> None:
    """Löscht einen Begriff."""
    found = await db.get(GlossaryEntry, entry_id)
    if found is None:
        raise NotFound
    await db.delete(found)
    await db.commit()

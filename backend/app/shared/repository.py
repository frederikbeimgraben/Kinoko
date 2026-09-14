"""Lesen und Schreiben je Tabelle. Kein Router sucht selbst."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Select, select

from app.core.errors import NotFound
from app.shared.paging import rows

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import User
    from app.shared.paging import Paging


class Repository[T]:
    """Der Zugang zu einer Tabelle."""

    def __init__(self, db: AsyncSession, model: type[T]) -> None:
        self.db = db
        self.model = model

    def query(self) -> Select[tuple[T]]:
        """Die Grundabfrage der Tabelle."""
        return select(self.model)

    async def get(self, row_id: uuid.UUID) -> T | None:
        """Liest eine Zeile, oder nichts."""
        return await self.db.get(self.model, row_id)

    async def get_or_404(self, row_id: uuid.UUID) -> T:
        """Liest eine Zeile, sonst Fehler."""
        found = await self.get(row_id)
        if found is None:
            raise NotFound
        return found

    async def one(self, *where: Any) -> T | None:  # noqa: ANN401
        """Liest die erste Zeile einer Bedingung."""
        found = await self.db.execute(self.query().where(*where))
        return found.scalars().first()

    async def one_or_404(self, *where: Any) -> T:  # noqa: ANN401
        """Liest die erste Zeile einer Bedingung, sonst Fehler."""
        found = await self.one(*where)
        if found is None:
            raise NotFound
        return found

    async def list(self, query: Select[tuple[T]], paging: Paging) -> Sequence[T]:
        """Liest eine Seite Zeilen, eine mehr als nötig."""
        return await rows(self.db, query, paging)

    def add(self, entity: T) -> T:
        """Nimmt eine neue Zeile auf."""
        self.db.add(entity)
        return entity

    async def delete(self, entity: T) -> None:
        """Löscht eine Zeile."""
        await self.db.delete(entity)

    async def commit(self) -> None:
        """Schreibt die Sitzung fest."""
        await self.db.commit()


class OwnedRepository[T](Repository[T]):
    """Der Zugang zu einer Tabelle mit Eigentümer."""

    def mine(self, user: User) -> Select[tuple[T]]:
        """Die Abfrage der eigenen Zeilen, ohne gelöschte."""
        owner = getattr(self.model, "owner_id")  # noqa: B009
        deleted = getattr(self.model, "deleted_at")  # noqa: B009
        return self.query().where(owner == user.id, deleted.is_(None))

    async def own(self, row_id: uuid.UUID, user: User) -> T:
        """Liest eine eigene Zeile, sonst Fehler."""
        found = await self.get(row_id)
        owner = getattr(found, "owner_id", None) if found is not None else None
        deleted = getattr(found, "deleted_at", None) if found is not None else None
        if found is None or owner != user.id or deleted is not None:
            raise NotFound
        return found

    def patch(self, entity: T, values: Mapping[str, Any]) -> T:
        """Setzt die gegebenen Felder einer Zeile."""
        for field, value in values.items():
            setattr(entity, field, value)
        return entity

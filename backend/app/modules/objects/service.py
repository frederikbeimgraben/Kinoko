"""Gemeinsame Lese- und Schreiblogik der vier Objektarten mit Eigentümer."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.core.errors import NotFound
from app.models import now
from app.shared.paging import page

if TYPE_CHECKING:
    import uuid
    from collections.abc import Callable, Mapping
    from datetime import datetime

    from sqlalchemy import Select

    from app.models import User
    from app.shared.paging import Paging
    from app.shared.repository import OwnedRepository
    from app.shared.schema import Schema


class ObjectService[T]:
    """CRUD und Geräteabgleich für eine Tabelle mit Eigentümer."""

    def __init__(self, repo: OwnedRepository[T]) -> None:
        self.repo = repo

    def own_query(self, user: User) -> Select[tuple[T]]:
        """Die Abfrage der eigenen, nicht gelöschten Zeilen."""
        return self.repo.mine(user)

    def since_query(self, user: User, stamp: datetime) -> Select[tuple[T]]:
        """Die Abfrage der eigenen Zeilen nach einem Zeitpunkt, auch gelöschte."""
        owner = getattr(self.repo.model, "owner_id")  # noqa: B009
        updated = getattr(self.repo.model, "updated_at")  # noqa: B009
        return self.repo.query().where(owner == user.id, updated > stamp)

    async def list(self, user: User, paging: Paging, out: Callable[[T], Schema]) -> dict[str, Any]:
        """Die eigenen, nicht gelöschten Zeilen, geblättert."""
        return await page(self.repo.db, self.own_query(user), paging, out)

    async def changes_since(
        self,
        user: User,
        stamp: datetime,
        paging: Paging,
        out: Callable[[T], Schema],
    ) -> dict[str, Any]:
        """Die eigenen Zeilen nach einem Zeitpunkt, auch die gelöschten."""
        return await page(self.repo.db, self.since_query(user, stamp), paging, out)

    async def create(self, entity: T) -> T:
        """Nimmt eine neue Zeile auf."""
        self.repo.add(entity)
        await self.repo.commit()
        return entity

    async def read(self, user: User, row_id: uuid.UUID) -> T:
        """Liest eine eigene Zeile."""
        return await self.repo.own(row_id, user)

    async def update(
        self,
        user: User,
        row_id: uuid.UUID,
        build: Callable[[], T],
        values: Mapping[str, Any],
    ) -> tuple[T, bool]:
        """Legt die Zeile mit dieser Kennung an, ersetzt sie, oder belebt sie neu."""
        found = await self.repo.get(row_id)
        owner = getattr(found, "owner_id", None) if found is not None else None
        if found is not None and owner != user.id:
            raise NotFound
        if found is None:
            entity = build()
            self.repo.add(entity)
            await self.repo.commit()
            return entity, True
        deleted = getattr(found, "deleted_at", None) is not None
        changes = dict(values)
        changes["updated_at"] = now()
        if deleted:
            changes["deleted_at"] = None
        self.repo.patch(found, changes)
        await self.repo.commit()
        return found, deleted

    async def delete(self, user: User, row_id: uuid.UUID) -> T:
        """Löscht eine eigene Zeile weich."""
        found = await self.repo.own(row_id, user)
        stamp = now()
        self.repo.patch(found, {"deleted_at": stamp, "updated_at": stamp})
        await self.repo.commit()
        return found

"""Zugang zu Rollen und Personen."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import delete, func, or_, select

from app.models import Role, RolePermission, User, UserRole
from app.shared.repository import Repository

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy import Select
    from sqlalchemy.ext.asyncio import AsyncSession


class RoleRepository(Repository[Role]):
    """Der Zugang zu Rollen."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Role)

    async def by_slug(self, slug: str) -> Role | None:
        """Liest eine Rolle über ihren Slug."""
        return await self.one(Role.slug == slug)

    async def by_ids(self, ids: Sequence[uuid.UUID]) -> Sequence[Role]:
        """Liest mehrere Rollen über ihre Schlüssel."""
        if not ids:
            return []
        found = await self.db.execute(select(Role).where(Role.id.in_(ids)))
        return list(found.scalars())

    async def permissions_of(self, role_id: uuid.UUID) -> frozenset[str]:
        """Liest die Rechte einer Rolle."""
        found = await self.db.execute(
            select(RolePermission.permission_key).where(RolePermission.role_id == role_id),
        )
        return frozenset(found.scalars())

    async def permissions_for(self, role_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, list[str]]:
        """Liest die Rechte mehrerer Rollen."""
        out: dict[uuid.UUID, list[str]] = {}
        if not role_ids:
            return out
        found = await self.db.execute(
            select(RolePermission.role_id, RolePermission.permission_key).where(
                RolePermission.role_id.in_(role_ids),
            ),
        )
        for role_id, key in found.all():
            out.setdefault(role_id, []).append(key)
        return out

    async def people_count(self, role_id: uuid.UUID) -> int:
        """Zählt die Personen mit dieser Rolle."""
        found = await self.db.execute(
            select(func.count()).select_from(UserRole).where(UserRole.role_id == role_id),
        )
        return found.scalar_one()

    async def people_counts(self, role_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
        """Zählt die Personen mehrerer Rollen."""
        if not role_ids:
            return {}
        found = await self.db.execute(
            select(UserRole.role_id, func.count())
            .where(UserRole.role_id.in_(role_ids))
            .group_by(UserRole.role_id),
        )
        return {role_id: total for role_id, total in found.all()}  # noqa: C416

    async def set_permissions(self, role_id: uuid.UUID, keys: Sequence[str]) -> None:
        """Setzt die Rechte einer Rolle neu."""
        await self.db.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
        for key in keys:
            self.db.add(RolePermission(role_id=role_id, permission_key=key))


class PersonRepository(Repository[User]):
    """Der Zugang zu Personen."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, User)

    def search(self, q: str | None) -> Select[tuple[User]]:
        """Die Abfrage der Personen, mit Suche über Sub, E-Mail und Name."""
        query = self.query().order_by(User.created_at)
        if not q:
            return query
        pattern = f"%{q}%"
        return query.where(
            or_(User.sub.ilike(pattern), User.email.ilike(pattern), User.name.ilike(pattern)),
        )

    async def role_ids_of(self, user_id: uuid.UUID) -> frozenset[uuid.UUID]:
        """Liest die Rollenschlüssel einer Person."""
        found = await self.db.execute(select(UserRole.role_id).where(UserRole.user_id == user_id))
        return frozenset(found.scalars())

    async def replace_roles(self, user_id: uuid.UUID, role_ids: Sequence[uuid.UUID]) -> None:
        """Setzt die Rollen einer Person neu."""
        await self.db.execute(delete(UserRole).where(UserRole.user_id == user_id))
        for role_id in role_ids:
            self.db.add(UserRole(user_id=user_id, role_id=role_id))

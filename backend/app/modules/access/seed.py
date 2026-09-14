"""Rechte und eingebaute Rollen beim Start."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models import Permission, Role, RolePermission
from app.modules.access.permissions import BUILT_IN, PERMISSIONS

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def sync_permissions(db: AsyncSession) -> None:
    """Schreibt fehlende Rechte nach und zieht den Bereich mit."""
    known = {row.key: row for row in (await db.execute(select(Permission))).scalars()}
    for key, area in PERMISSIONS.items():
        found = known.get(key)
        if found is None:
            db.add(Permission(key=key, area=area))
        else:
            found.area = area
    for key, row in known.items():
        if key not in PERMISSIONS:
            await db.delete(row)
    await db.commit()


async def sync_roles(db: AsyncSession) -> None:
    """Legt die eingebauten Rollen an und setzt ihre Rechte."""
    known = {row.slug: row for row in (await db.execute(select(Role))).scalars()}
    for slug, (name, keys) in BUILT_IN.items():
        role = known.get(slug)
        if role is None:
            role = Role(slug=slug, name=name, built_in=True)
            db.add(role)
            await db.flush()
        role.built_in = True
        held = {
            row.permission_key
            for row in (
                await db.execute(select(RolePermission).where(RolePermission.role_id == role.id))
            ).scalars()
        }
        for key in keys:
            if key not in held:
                db.add(RolePermission(role_id=role.id, permission_key=key))
    await db.commit()


async def sync(db: AsyncSession) -> None:
    """Gleicht Rechte und Rollen ab."""
    await sync_permissions(db)
    await sync_roles(db)

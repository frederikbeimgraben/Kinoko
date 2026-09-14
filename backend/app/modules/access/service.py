"""Rechte, Rollen, Personen und die eigenen Daten eines Kontos."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Final

from sqlalchemy import delete, select

from app.core.errors import Conflict, Invalid, NotFound
from app.models import Combination, Find, Marker, Photo, Role, RolePermission, User, UserRole, Zone
from app.modules.access import export
from app.modules.access.permissions import PERMISSIONS
from app.modules.access.repository import PersonRepository, RoleRepository
from app.modules.access.schemas import Person, RoleBrief
from app.modules.access.schemas import Role as RoleOut
from app.shared.paging import wrap

if TYPE_CHECKING:
    import uuid
    from collections.abc import Mapping, Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.core.auth import Viewer
    from app.shared.paging import Paging

ADMIN_SLUG: Final = "admin"


class AccessService:
    """Rechte, Rollen, Personen und die eigenen Daten eines Kontos."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.roles = RoleRepository(db)
        self.people = PersonRepository(db)

    async def ensure_person(self, who: Viewer) -> User:
        """Liefert das Konto zum Token. Beim ersten Aufruf legt es die Zeile an."""
        query = select(User).where(User.sub == who.sub)
        found = (await self.db.execute(query)).scalar_one_or_none()
        email = who.claims.get("email")
        name = who.claims.get("name")
        if found is not None and found.email == email and found.name == name:
            return found
        if found is None:
            found = User(sub=who.sub)
            self.db.add(found)
        found.email = email
        found.name = name
        await self.db.commit()
        await self.db.refresh(found)
        return found

    async def permissions_of(self, user: User) -> frozenset[str]:
        """Liest die Rechte eines Kontos aus seinen Rollen."""
        found = await self.db.execute(
            select(RolePermission.permission_key)
            .join(UserRole, UserRole.role_id == RolePermission.role_id)
            .where(UserRole.user_id == user.id),
        )
        return frozenset(found.scalars())

    def _validate_permissions(self, keys: Sequence[str]) -> None:
        if any(key not in PERMISSIONS for key in keys):
            raise Invalid(errors=[{"field": "permissions", "code": "unknown_permission"}])

    async def _role_out(
        self,
        role: Role,
        permissions: Sequence[str] | None = None,
        people: int | None = None,
    ) -> dict[str, Any]:
        if permissions is None:
            permissions = sorted(await self.roles.permissions_of(role.id))
        keys = permissions
        count = people if people is not None else await self.roles.people_count(role.id)
        return RoleOut(
            id=role.id,
            slug=role.slug,
            name=role.name,
            description=role.description,
            built_in=role.built_in,
            permissions=list(keys),
            people_count=count,
            created_at=role.created_at,
            updated_at=role.updated_at,
        ).dumped()

    async def list_roles(self, paging: Paging) -> dict[str, Any]:
        """Liest eine Seite Rollen mit ihren Rechten und Personenzahl."""
        found = await self.roles.list(self.roles.query().order_by(Role.slug), paging)
        ids = [role.id for role in found]
        permissions = await self.roles.permissions_for(ids)
        counts = await self.roles.people_counts(ids)

        def out(role: Role) -> RoleOut:
            return RoleOut(
                id=role.id,
                slug=role.slug,
                name=role.name,
                description=role.description,
                built_in=role.built_in,
                permissions=sorted(permissions.get(role.id, [])),
                people_count=counts.get(role.id, 0),
                created_at=role.created_at,
                updated_at=role.updated_at,
            )

        return wrap(found, paging, out)

    async def create_role(
        self,
        slug: str,
        name: str,
        description: str | None,
        permissions: Sequence[str],
    ) -> dict[str, Any]:
        """Legt eine Rolle an."""
        self._validate_permissions(permissions)
        if await self.roles.by_slug(slug) is not None:
            raise Conflict("slug_taken")
        role = self.roles.add(Role(slug=slug, name=name, description=description))
        await self.db.flush()
        await self.roles.set_permissions(role.id, permissions)
        await self.db.commit()
        await self.db.refresh(role)
        return await self._role_out(role, permissions=list(permissions), people=0)

    async def get_role(self, role_id: uuid.UUID) -> dict[str, Any]:
        """Liest eine Rolle."""
        role = await self.roles.get_or_404(role_id)
        return await self._role_out(role)

    async def update_role(self, role_id: uuid.UUID, patch: Mapping[str, Any]) -> dict[str, Any]:
        """Ändert Name, Beschreibung oder Rechte einer Rolle."""
        role = await self.roles.get_or_404(role_id)
        if "permissions" in patch:
            self._validate_permissions(patch["permissions"])
        if "name" in patch:
            role.name = patch["name"]
        if "description" in patch:
            role.description = patch["description"]
        if "permissions" in patch:
            await self.roles.set_permissions(role.id, patch["permissions"])
        await self.db.commit()
        await self.db.refresh(role)
        return await self._role_out(role)

    async def delete_role(self, role_id: uuid.UUID) -> None:
        """Löscht eine Rolle ohne Personen. Eingebaute Rollen bleiben stehen."""
        role = await self.roles.get_or_404(role_id)
        if role.built_in or await self.roles.people_count(role.id) > 0:
            raise Conflict("in_use")
        await self.roles.delete(role)
        await self.db.commit()

    async def _roles_for(self, user_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, list[RoleBrief]]:
        out: dict[uuid.UUID, list[RoleBrief]] = {}
        if not user_ids:
            return out
        found = await self.db.execute(
            select(UserRole.user_id, Role)
            .join(Role, Role.id == UserRole.role_id)
            .where(UserRole.user_id.in_(user_ids)),
        )
        for user_id, role in found.all():
            brief = RoleBrief(id=role.id, slug=role.slug, name=role.name)
            out.setdefault(user_id, []).append(brief)
        return out

    def _person_out(self, person: User, roles: Sequence[RoleBrief]) -> Person:
        return Person(
            id=person.id,
            sub=person.sub,
            email=person.email,
            name=person.name,
            roles=list(roles),
            created_at=person.created_at,
        )

    async def list_people(self, q: str | None, paging: Paging) -> dict[str, Any]:
        """Liest eine Seite Personen mit ihren Rollen."""
        found = await self.people.list(self.people.search(q), paging)
        roles = await self._roles_for([person.id for person in found])

        def out(person: User) -> Person:
            return self._person_out(person, roles.get(person.id, []))

        return wrap(found, paging, out)

    async def get_person(self, person_id: uuid.UUID) -> dict[str, Any]:
        """Liest eine Person."""
        person = await self.people.get_or_404(person_id)
        roles = await self._roles_for([person.id])
        return self._person_out(person, roles.get(person.id, [])).dumped()

    async def guard_last_admin(
        self,
        person: User,
        new_role_ids: Sequence[uuid.UUID] | None,
    ) -> None:
        """Sperrt den Verlust der letzten Admin-Rolle. ``None`` heißt: das Konto geht verloren."""
        admin = await self.roles.by_slug(ADMIN_SLUG)
        if admin is None:
            return
        held = admin.id in await self.people.role_ids_of(person.id)
        if not held:
            return
        if new_role_ids is not None and admin.id in new_role_ids:
            return
        if await self.roles.people_count(admin.id) <= 1:
            raise Conflict("last_admin")

    async def delete_person(self, person_id: uuid.UUID) -> None:
        """Löscht eine Person, sofern sie nicht die letzte Admin-Rolle trägt."""
        person = await self.people.get_or_404(person_id)
        await self.guard_last_admin(person, None)
        await self.people.delete(person)
        await self.db.commit()

    async def set_person_roles(
        self,
        person_id: uuid.UUID,
        role_ids: Sequence[uuid.UUID],
    ) -> dict[str, Any]:
        """Setzt die Rollen einer Person neu."""
        person = await self.people.get_or_404(person_id)
        unique_ids = list(dict.fromkeys(role_ids))
        if len(await self.roles.by_ids(unique_ids)) != len(unique_ids):
            raise NotFound
        await self.guard_last_admin(person, unique_ids)
        await self.people.replace_roles(person.id, unique_ids)
        await self.db.commit()
        roles = await self._roles_for([person.id])
        return self._person_out(person, roles.get(person.id, [])).dumped()

    async def export_own(self, user: User) -> dict[str, Any]:
        """Baut den Datenexport eines Kontos: eigene Funde, Objekte und Fotos."""
        return await export.build(self.db, user)

    async def delete_own(self, user: User) -> None:
        """Löscht alle eigenen Funde, Marker, Zonen, Kombinationen und Fotos."""
        await self.db.execute(delete(Photo).where(Photo.owner_id == user.id))
        await self.db.execute(delete(Find).where(Find.owner_id == user.id))
        await self.db.execute(delete(Marker).where(Marker.owner_id == user.id))
        await self.db.execute(delete(Zone).where(Zone.owner_id == user.id))
        await self.db.execute(delete(Combination).where(Combination.owner_id == user.id))
        await self.db.commit()

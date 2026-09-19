"""Die Regeln der Freundesgruppen: Mitglieder, Beitrittscode, Sichtbarkeit."""

from __future__ import annotations

import secrets
import uuid
from typing import TYPE_CHECKING, Final

from sqlalchemy import Select, select, update

from app.core.errors import Forbidden, NotFound
from app.models import Find, FriendGroup, GroupMember, Marker, User, Zone, now
from app.shared.enums import Visibility

if TYPE_CHECKING:
    from collections.abc import Iterable, Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

CODE_PREFIX: Final = "PILZ-"
CODE_ALPHABET: Final = "ACDEFGHJKLMNPQRSTUVWXYZ2345679"
CODE_BODY: Final = 4
CODE_TRIES: Final = 20

OWNED: Final = (Find, Marker, Zone)


def new_code() -> str:
    """Erzeugt einen Beitrittscode ohne verwechselbare Zeichen."""
    body = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_BODY))
    return CODE_PREFIX + body


class GroupService:
    """Lesen und Schreiben der Gruppen eines Kontos."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def my_ids(self, user: User | None) -> set[uuid.UUID]:
        """Die Kennungen der Gruppen, in denen das Konto Mitglied ist."""
        if user is None:
            return set()
        query = select(GroupMember.group_id).where(GroupMember.user_id == user.id)
        return set((await self.db.execute(query)).scalars())

    def sorted_query(self) -> Select[tuple[FriendGroup]]:
        """Die Gruppen nach Name."""
        return select(FriendGroup).order_by(FriendGroup.name)

    async def mine(self, user: User) -> Sequence[FriendGroup]:
        """Die Gruppen des Kontos."""
        held = await self.my_ids(user)
        query = self.sorted_query().where(FriendGroup.id.in_(held))
        return list((await self.db.execute(query)).scalars())

    async def every(self) -> Sequence[FriendGroup]:
        """Alle Gruppen. Nur für die Verwaltung."""
        return list((await self.db.execute(self.sorted_query())).scalars())

    async def members(self, group_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, list[GroupMember]]:
        """Die Mitglieder je Gruppe, Eigentümer zuerst."""
        query = (
            select(GroupMember)
            .where(GroupMember.group_id.in_(list(group_ids)))
            .order_by(GroupMember.joined_at)
        )
        found: dict[uuid.UUID, list[GroupMember]] = {}
        for row in (await self.db.execute(query)).scalars():
            found.setdefault(row.group_id, []).append(row)
        return found

    async def names(self, user_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, str]:
        """Der Anzeigename je Konto."""
        query = select(User).where(User.id.in_(list(user_ids)))
        found = (await self.db.execute(query)).scalars()
        return {row.id: row.name or row.email or row.sub for row in found}

    async def create(self, user: User, name: str) -> FriendGroup:
        """Legt eine Gruppe an und nimmt den Eigentümer auf."""
        made = FriendGroup(name=name, owner_id=user.id, invite_code=await self.free_code())
        self.db.add(made)
        await self.db.flush()
        self.db.add(GroupMember(group_id=made.id, user_id=user.id))
        await self.db.commit()
        return made

    async def free_code(self) -> str:
        """Sucht einen Code, den noch keine Gruppe trägt."""
        for _ in range(CODE_TRIES):
            code = new_code()
            query = select(FriendGroup.id).where(FriendGroup.invite_code == code)
            if (await self.db.execute(query)).first() is None:
                return code
        return CODE_PREFIX + uuid.uuid4().hex[:8].upper()

    async def by_code(self, code: str) -> FriendGroup:
        """Die Gruppe zu einem Beitrittscode."""
        query = select(FriendGroup).where(FriendGroup.invite_code == code.strip().upper())
        found = (await self.db.execute(query)).scalars().first()
        if found is None:
            raise NotFound
        return found

    async def join(self, user: User, code: str) -> FriendGroup:
        """Nimmt das Konto in die Gruppe zum Code auf."""
        group = await self.by_code(code)
        if group.id not in await self.my_ids(user):
            self.db.add(GroupMember(group_id=group.id, user_id=user.id))
            await self.db.commit()
        return group

    async def get(self, group_id: uuid.UUID) -> FriendGroup:
        """Die Gruppe zu einer Kennung."""
        found = await self.db.get(FriendGroup, group_id)
        if found is None:
            raise NotFound
        return found

    async def read(self, user: User, group_id: uuid.UUID, *, manage: bool) -> FriendGroup:
        """Liest eine Gruppe. Ohne Mitgliedschaft und ohne Recht bleibt sie verborgen."""
        group = await self.get(group_id)
        if not manage and group_id not in await self.my_ids(user):
            raise NotFound
        return group

    async def owned(self, user: User, group_id: uuid.UUID, *, manage: bool) -> FriendGroup:
        """Liest eine Gruppe, die das Konto führt."""
        group = await self.get(group_id)
        if not manage and group.owner_id != user.id:
            raise Forbidden
        return group

    async def rename(
        self,
        user: User,
        group_id: uuid.UUID,
        name: str,
        *,
        manage: bool,
    ) -> FriendGroup:
        """Setzt den Namen einer Gruppe."""
        group = await self.owned(user, group_id, manage=manage)
        group.name = name
        await self.db.commit()
        return group

    async def delete(self, user: User, group_id: uuid.UUID, *, manage: bool) -> None:
        """Löscht eine Gruppe. Ihre Einträge werden wieder privat."""
        group = await self.owned(user, group_id, manage=manage)
        await self.detach(group_id)
        await self.db.delete(group)
        await self.db.commit()

    async def remove_member(
        self,
        user: User,
        group_id: uuid.UUID,
        member_id: uuid.UUID,
        *,
        manage: bool,
    ) -> None:
        """Nimmt ein Mitglied aus der Gruppe. Der Eigentümer löscht statt zu gehen."""
        group = await self.get(group_id)
        if member_id == group.owner_id:
            raise Forbidden
        if not manage and user.id not in (group.owner_id, member_id):
            raise Forbidden
        query = select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == member_id,
        )
        found = (await self.db.execute(query)).scalars().first()
        if found is None:
            raise NotFound
        await self.db.delete(found)
        await self.detach(group_id, member_id)
        await self.db.commit()

    async def detach(self, group_id: uuid.UUID, owner_id: uuid.UUID | None = None) -> None:
        """Macht die Einträge der Gruppe wieder privat."""
        for model in OWNED:
            query = update(model).where(model.group_id == group_id)
            if owner_id is not None:
                query = query.where(model.owner_id == owner_id)
            await self.db.execute(
                query.values(group_id=None, visibility=Visibility.PRIVATE, updated_at=now())
            )

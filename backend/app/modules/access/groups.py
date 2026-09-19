"""Die Endpunkte der Freundesgruppen."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Annotated, Any

from fastapi import APIRouter, Path, Query, status
from pydantic import Field

from app.core.auth import CurrentUser, CurrentViewer, Db
from app.core.errors import Forbidden
from app.modules.access.group_service import GroupService
from app.shared.schema import Schema, Timestamp

if TYPE_CHECKING:
    from collections.abc import Sequence

    from app.models import FriendGroup as GroupRow
    from app.models import GroupMember as MemberRow

router = APIRouter(tags=["groups"])

GroupId = Annotated[uuid.UUID, Path(alias="id")]
MemberId = Annotated[uuid.UUID, Path(alias="userId")]
MANAGE = "group.manage"


class FriendGroupWrite(Schema):
    """Der Name einer Gruppe."""

    name: str = Field(min_length=1, max_length=60)


class FriendGroupJoin(Schema):
    """Der Beitrittscode einer Gruppe."""

    invite_code: str


class FriendGroupMember(Schema):
    """Ein Mitglied einer Gruppe."""

    user_id: uuid.UUID
    name: str
    joined_at: Timestamp


class FriendGroup(Schema):
    """Eine Gruppe mit ihren Mitgliedern."""

    id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    invite_code: str
    members: list[FriendGroupMember]
    created_at: Timestamp


async def dumped(db: Db, groups: Sequence[GroupRow]) -> list[dict[str, Any]]:
    """Baut die Gruppen mit ihren Mitgliedern für die Antwort."""
    service = GroupService(db)
    rows = await service.members(group.id for group in groups)
    people = {row.user_id for held in rows.values() for row in held}
    names = await service.names(people)

    def member(row: MemberRow) -> FriendGroupMember:
        return FriendGroupMember(
            user_id=row.user_id,
            name=names.get(row.user_id, ""),
            joined_at=row.joined_at,
        )

    return [
        FriendGroup(
            id=group.id,
            name=group.name,
            owner_id=group.owner_id,
            invite_code=group.invite_code,
            members=[member(row) for row in rows.get(group.id, [])],
            created_at=group.created_at,
        ).dumped()
        for group in groups
    ]


@router.get("/groups")
async def list_groups(
    db: Db,
    user: CurrentUser,
    who: CurrentViewer,
    every: Annotated[bool, Query(alias="all")] = False,  # noqa: FBT002
) -> Any:  # noqa: ANN401
    """Die eigenen Gruppen, mit dem Recht `group.manage` auch alle."""
    service = GroupService(db)
    if not every:
        return {"items": await dumped(db, await service.mine(user))}
    if not who.may(MANAGE):
        raise Forbidden
    return {"items": await dumped(db, await service.every())}


@router.post("/groups", status_code=status.HTTP_201_CREATED)
async def create_group(db: Db, user: CurrentUser, body: FriendGroupWrite) -> Any:  # noqa: ANN401
    """Legt eine Gruppe an."""
    made = await GroupService(db).create(user, body.name)
    return (await dumped(db, [made]))[0]


@router.post("/groups/join")
async def join_group(db: Db, user: CurrentUser, body: FriendGroupJoin) -> Any:  # noqa: ANN401
    """Tritt einer Gruppe über ihren Beitrittscode bei."""
    group = await GroupService(db).join(user, body.invite_code)
    return (await dumped(db, [group]))[0]


@router.get("/groups/{id}")  # noqa: FAST003
async def get_group(db: Db, user: CurrentUser, who: CurrentViewer, group_id: GroupId) -> Any:  # noqa: ANN401
    """Liest eine Gruppe."""
    group = await GroupService(db).read(user, group_id, manage=who.may(MANAGE))
    return (await dumped(db, [group]))[0]


@router.put("/groups/{id}")  # noqa: FAST003
async def update_group(
    db: Db,
    user: CurrentUser,
    who: CurrentViewer,
    group_id: GroupId,
    body: FriendGroupWrite,
) -> Any:  # noqa: ANN401
    """Benennt eine Gruppe um."""
    group = await GroupService(db).rename(user, group_id, body.name, manage=who.may(MANAGE))
    return (await dumped(db, [group]))[0]


@router.delete("/groups/{id}", status_code=status.HTTP_204_NO_CONTENT)  # noqa: FAST003
async def delete_group(db: Db, user: CurrentUser, who: CurrentViewer, group_id: GroupId) -> None:
    """Löscht eine Gruppe. Ihre Einträge werden wieder privat."""
    await GroupService(db).delete(user, group_id, manage=who.may(MANAGE))


@router.delete(
    "/groups/{id}/members/{userId}",  # noqa: FAST003
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_group_member(
    db: Db,
    user: CurrentUser,
    who: CurrentViewer,
    group_id: GroupId,
    member_id: MemberId,
) -> None:
    """Nimmt ein Mitglied aus der Gruppe, oder verlässt sie."""
    await GroupService(db).remove_member(user, group_id, member_id, manage=who.may(MANAGE))

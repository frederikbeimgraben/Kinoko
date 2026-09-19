import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.access.group_service import CODE_PREFIX
from tests.conftest import app_of, make_user, sign_in


async def a_group(api: httpx.AsyncClient, name: str = "Familie") -> dict[str, object]:
    """Legt eine Gruppe an und liefert ihren Körper."""
    made = await api.post("/groups", json={"name": name})
    assert made.status_code == 201
    return made.json()


async def test_create_puts_the_owner_in_the_group(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    body = await a_group(api)
    assert body["name"] == "Familie"
    assert body["ownerId"] == str(anna.id)
    assert str(body["inviteCode"]).startswith(CODE_PREFIX)
    assert [member["name"] for member in body["members"]] == ["anna"]


async def test_list_shows_only_own_groups(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    await a_group(api, "Anna")
    sign_in(app_of(api), bert)
    await a_group(api, "Bert")
    listed = await api.get("/groups")
    assert [item["name"] for item in listed.json()["items"]] == ["Bert"]


async def test_list_all_needs_the_right(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    await a_group(api, "Anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), bert)
    assert (await api.get("/groups", params={"all": True})).status_code == 403
    sign_in(app_of(api), bert, "group.manage")
    every = await api.get("/groups", params={"all": True})
    assert [item["name"] for item in every.json()["items"]] == ["Anna"]


async def test_list_requires_login(api: httpx.AsyncClient) -> None:
    assert (await api.get("/groups")).status_code == 401


async def test_join_with_the_invite_code(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    sign_in(app_of(api), bert)
    joined = await api.post("/groups/join", json={"inviteCode": group["inviteCode"]})
    assert joined.status_code == 200
    assert {member["name"] for member in joined.json()["members"]} == {"anna", "bert"}
    again = await api.post("/groups/join", json={"inviteCode": group["inviteCode"]})
    assert len(again.json()["members"]) == 2


async def test_join_with_an_unknown_code(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    assert (await api.post("/groups/join", json={"inviteCode": "PILZ-0000"})).status_code == 404


async def test_read_needs_membership(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    assert (await api.get(f"/groups/{group['id']}")).status_code == 200
    sign_in(app_of(api), bert)
    assert (await api.get(f"/groups/{group['id']}")).status_code == 404
    sign_in(app_of(api), bert, "group.manage")
    assert (await api.get(f"/groups/{group['id']}")).status_code == 200


async def test_rename_belongs_to_the_owner(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    sign_in(app_of(api), bert)
    await api.post("/groups/join", json={"inviteCode": group["inviteCode"]})
    assert (await api.put(f"/groups/{group['id']}", json={"name": "Neu"})).status_code == 403
    sign_in(app_of(api), anna)
    renamed = await api.put(f"/groups/{group['id']}", json={"name": "Neu"})
    assert renamed.json()["name"] == "Neu"


async def test_owner_removes_a_member(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    sign_in(app_of(api), bert)
    await api.post("/groups/join", json={"inviteCode": group["inviteCode"]})
    sign_in(app_of(api), anna)
    gone = await api.delete(f"/groups/{group['id']}/members/{bert.id}")
    assert gone.status_code == 204
    assert len((await api.get(f"/groups/{group['id']}")).json()["members"]) == 1


async def test_a_member_leaves(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    sign_in(app_of(api), bert)
    await api.post("/groups/join", json={"inviteCode": group["inviteCode"]})
    left = await api.delete(f"/groups/{group['id']}/members/{bert.id}")
    assert left.status_code == 204
    assert (await api.get("/groups")).json()["items"] == []


async def test_the_owner_cannot_leave(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    assert (await api.delete(f"/groups/{group['id']}/members/{anna.id}")).status_code == 403


async def test_removing_someone_outside_the_group(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    assert (await api.delete(f"/groups/{group['id']}/members/{bert.id}")).status_code == 404


async def test_a_stranger_removes_nobody(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    carl = await make_user(session, "carl")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    sign_in(app_of(api), bert)
    await api.post("/groups/join", json={"inviteCode": group["inviteCode"]})
    sign_in(app_of(api), carl)
    assert (await api.delete(f"/groups/{group['id']}/members/{bert.id}")).status_code == 403


async def test_delete_belongs_to_the_owner(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    sign_in(app_of(api), bert)
    assert (await api.delete(f"/groups/{group['id']}")).status_code == 403
    sign_in(app_of(api), bert, "group.manage")
    assert (await api.delete(f"/groups/{group['id']}")).status_code == 204
    sign_in(app_of(api), anna)
    assert (await api.get(f"/groups/{group['id']}")).status_code == 404


async def test_an_unknown_group(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    missing = "11111111-1111-1111-1111-111111111111"
    assert (await api.get(f"/groups/{missing}")).status_code == 404
    assert (await api.put(f"/groups/{missing}", json={"name": "X"})).status_code == 404
    assert (await api.delete(f"/groups/{missing}")).status_code == 404

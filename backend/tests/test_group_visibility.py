import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from tests.conftest import app_of, make_user, sign_in

FIND = {"lat": 50.0, "lon": 8.0, "foundOn": "2026-09-01"}
MARKER = {"name": "Stelle", "lat": 50.0, "lon": 8.0}
ZONE = {
    "name": "Wald",
    "polygon": {
        "type": "Polygon",
        "coordinates": [[[8.0, 50.0], [8.01, 50.0], [8.01, 50.01], [8.0, 50.01], [8.0, 50.0]]],
    },
}


async def a_group(api: httpx.AsyncClient, name: str = "Familie") -> dict[str, object]:
    """Legt eine Gruppe an und liefert ihren Körper."""
    return (await api.post("/groups", json={"name": name})).json()


async def join(api: httpx.AsyncClient, user: User, group: dict[str, object]) -> None:
    """Nimmt ein Konto in eine Gruppe auf."""
    sign_in(app_of(api), user)
    await api.post("/groups/join", json={"inviteCode": group["inviteCode"]})


async def test_shared_without_a_group_is_refused(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    answer = await api.post("/finds", json={**FIND, "visibility": "shared"})
    assert answer.status_code == 422
    assert answer.json()["errors"] == [{"field": "groupId", "code": "group"}]


async def test_shared_to_a_foreign_group_is_refused(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    sign_in(app_of(api), bert)
    body = {**FIND, "visibility": "shared", "groupId": group["id"]}
    assert (await api.post("/finds", json=body)).status_code == 422


async def test_private_drops_the_group(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    body = {**FIND, "visibility": "private", "groupId": group["id"]}
    made = await api.post("/finds", json=body)
    assert made.json()["groupId"] is None


async def test_the_group_sees_a_shared_find(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    carl = await make_user(session, "carl")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    made = await api.post("/finds", json={**FIND, "visibility": "shared", "groupId": group["id"]})
    assert made.json()["groupId"] == group["id"]
    await join(api, bert, group)
    seen = await api.get("/finds", params={"mine": False})
    assert [item["id"] for item in seen.json()["items"]] == [made.json()["id"]]
    sign_in(app_of(api), carl)
    assert (await api.get("/finds", params={"mine": False})).json()["items"] == []


async def test_a_guest_sees_no_shared_find(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    await api.post("/finds", json={**FIND, "visibility": "shared", "groupId": group["id"]})
    app_of(api).dependency_overrides.clear()
    assert (await api.get("/finds", params={"mine": False})).json()["items"] == []


async def test_markers_and_zones_carry_the_group(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    shared = {"visibility": "shared", "groupId": group["id"]}
    marker = await api.post("/markers", json={**MARKER, **shared})
    zone = await api.post("/zones", json={**ZONE, **shared})
    assert marker.json()["groupId"] == group["id"]
    assert zone.json()["groupId"] == group["id"]
    assert (await api.post("/markers", json={**MARKER, "visibility": "shared"})).status_code == 422
    assert (await api.post("/zones", json={**ZONE, "visibility": "shared"})).status_code == 422


async def test_deleting_a_group_makes_its_entries_private(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    shared = {"visibility": "shared", "groupId": group["id"]}
    find = (await api.post("/finds", json={**FIND, **shared})).json()
    marker = (await api.post("/markers", json={**MARKER, **shared})).json()
    assert (await api.delete(f"/groups/{group['id']}")).status_code == 204
    after = (await api.get(f"/finds/{find['id']}")).json()
    assert after["visibility"] == "private"
    assert after["groupId"] is None
    assert (await api.get(f"/markers/{marker['id']}")).json()["groupId"] is None


async def test_removing_a_member_makes_only_their_entries_private(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    shared = {"visibility": "shared", "groupId": group["id"]}
    hers = (await api.post("/finds", json={**FIND, **shared})).json()
    await join(api, bert, group)
    his = (await api.post("/finds", json={**FIND, **shared})).json()
    sign_in(app_of(api), anna)
    assert (await api.delete(f"/groups/{group['id']}/members/{bert.id}")).status_code == 204
    assert (await api.get(f"/finds/{hers['id']}")).json()["groupId"] == group["id"]
    sign_in(app_of(api), bert)
    assert (await api.get(f"/finds/{his['id']}")).json()["visibility"] == "private"


async def test_put_keeps_the_group_rule(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    group = await a_group(api)
    find_id = "33333333-3333-3333-3333-333333333333"
    body = {**FIND, "visibility": "shared", "groupId": group["id"]}
    assert (await api.put(f"/finds/{find_id}", json=body)).status_code == 201
    back = await api.put(f"/finds/{find_id}", json={**FIND, "visibility": "private"})
    assert back.json()["groupId"] is None

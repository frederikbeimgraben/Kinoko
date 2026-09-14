import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import app_of, make_user, sign_in


async def test_create_and_get_marker(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/markers", json={"name": "Fundstelle", "lat": 50.1, "lon": 8.6})
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Fundstelle"
    assert body["colour"] == "green"
    assert body["deleted"] is False
    fetched = await api.get(f"/markers/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == body["id"]


async def test_list_returns_only_own_markers(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    await api.post("/markers", json={"name": "A", "lat": 1.0, "lon": 1.0})
    sign_in(app_of(api), bert)
    await api.post("/markers", json={"name": "B", "lat": 2.0, "lon": 2.0})
    listed = await api.get("/markers")
    names = {item["name"] for item in listed.json()["items"]}
    assert names == {"B"}


async def test_list_requires_login(api: httpx.AsyncClient) -> None:
    answer = await api.get("/markers")
    assert answer.status_code == 401


async def test_put_creates_with_given_id(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    marker_id = "11111111-1111-1111-1111-111111111111"
    answer = await api.put(
        f"/markers/{marker_id}",
        json={"name": "Gerät", "lat": 3.0, "lon": 4.0},
    )
    assert answer.status_code == 201
    assert answer.json()["id"] == marker_id


async def test_put_replaces_existing_marker(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    marker_id = "22222222-2222-2222-2222-222222222222"
    await api.put(f"/markers/{marker_id}", json={"name": "Alt", "lat": 1.0, "lon": 1.0})
    answer = await api.put(f"/markers/{marker_id}", json={"name": "Neu", "lat": 1.0, "lon": 1.0})
    assert answer.status_code == 200
    assert answer.json()["name"] == "Neu"


async def test_put_of_foreign_id_is_not_found(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    marker_id = "33333333-3333-3333-3333-333333333333"
    await api.put(f"/markers/{marker_id}", json={"name": "Anna", "lat": 1.0, "lon": 1.0})
    sign_in(app_of(api), bert)
    answer = await api.put(f"/markers/{marker_id}", json={"name": "Bert", "lat": 1.0, "lon": 1.0})
    assert answer.status_code == 404


async def test_delete_then_get_is_not_found(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/markers", json={"name": "A", "lat": 1.0, "lon": 1.0})
    marker_id = created.json()["id"]
    deleted = await api.delete(f"/markers/{marker_id}")
    assert deleted.status_code == 204
    again = await api.delete(f"/markers/{marker_id}")
    assert again.status_code == 404
    fetched = await api.get(f"/markers/{marker_id}")
    assert fetched.status_code == 404


async def test_put_revives_a_deleted_marker(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/markers", json={"name": "A", "lat": 1.0, "lon": 1.0})
    marker_id = created.json()["id"]
    await api.delete(f"/markers/{marker_id}")
    revived = await api.put(f"/markers/{marker_id}", json={"name": "B", "lat": 1.0, "lon": 1.0})
    assert revived.status_code == 201
    assert revived.json()["deleted"] is False


async def test_changes_since_includes_deleted_rows(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/markers", json={"name": "A", "lat": 1.0, "lon": 1.0})
    marker_id = created.json()["id"]
    await api.delete(f"/markers/{marker_id}")
    listed = await api.get("/markers", params={"since": "1970-01-01T00:00:00Z"})
    match = next(item for item in listed.json()["items"] if item["id"] == marker_id)
    assert match["deleted"] is True


async def test_list_without_since_excludes_deleted_rows(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/markers", json={"name": "A", "lat": 1.0, "lon": 1.0})
    marker_id = created.json()["id"]
    await api.delete(f"/markers/{marker_id}")
    listed = await api.get("/markers")
    ids = {item["id"] for item in listed.json()["items"]}
    assert marker_id not in ids


async def test_pagination_returns_a_next_cursor(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    await api.post("/markers", json={"name": "A", "lat": 1.0, "lon": 1.0})
    await api.post("/markers", json={"name": "B", "lat": 1.0, "lon": 1.0})
    first = await api.get("/markers", params={"limit": 1})
    assert len(first.json()["items"]) == 1
    assert first.json()["nextCursor"] is not None

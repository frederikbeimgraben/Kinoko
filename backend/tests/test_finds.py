import uuid

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.objects import find_service
from app.shared.enums import Protection
from tests.conftest import app_of, make_user, sign_in, sign_out
from tests.objects_support import make_species


async def test_create_and_get_find(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post(
        "/finds",
        json={"lat": 50.1, "lon": 8.6, "foundOn": "2026-09-01"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["reviewState"] == "open"
    fetched = await api.get(f"/finds/{body['id']}")
    assert fetched.status_code == 200


async def test_list_mine_requires_login(api: httpx.AsyncClient) -> None:
    assert (await api.get("/finds")).status_code == 401


async def test_list_mine_returns_only_own_finds(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    await api.post("/finds", json={"lat": 1.0, "lon": 1.0, "foundOn": "2026-09-01"})
    sign_in(app_of(api), bert)
    await api.post("/finds", json={"lat": 2.0, "lon": 2.0, "foundOn": "2026-09-01"})
    listed = await api.get("/finds")
    assert len(listed.json()["items"]) == 1
    assert listed.json()["items"][0]["lat"] == 2.0


async def test_shared_finds_are_visible_without_login(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    await api.post(
        "/finds",
        json={"lat": 1.0, "lon": 1.0, "foundOn": "2026-09-01", "visibility": "shared"},
    )
    sign_out(app_of(api))
    listed = await api.get("/finds", params={"mine": "false"})
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1


async def test_shared_finds_exclude_private_ones(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    await api.post("/finds", json={"lat": 1.0, "lon": 1.0, "foundOn": "2026-09-01"})
    listed = await api.get("/finds", params={"mine": "false"})
    assert listed.json()["items"] == []


async def test_shared_finds_respect_since(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    await api.post(
        "/finds",
        json={"lat": 1.0, "lon": 1.0, "foundOn": "2026-09-01", "visibility": "shared"},
    )
    sign_out(app_of(api))
    listed = await api.get(
        "/finds",
        params={"mine": "false", "since": "1970-01-01T00:00:00Z"},
    )
    assert len(listed.json()["items"]) == 1
    future = await api.get(
        "/finds",
        params={"mine": "false", "since": "2100-01-01T00:00:00Z"},
    )
    assert future.json()["items"] == []


async def test_shared_finds_exclude_the_viewers_own(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    await api.post(
        "/finds",
        json={"lat": 1.0, "lon": 1.0, "foundOn": "2026-09-01", "visibility": "shared"},
    )
    listed = await api.get("/finds", params={"mine": "false"})
    assert listed.json()["items"] == []


async def test_shared_finds_coarsen_a_protected_species(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    species = await make_species(session, protection=Protection.STRICT)
    sign_in(app_of(api), anna)
    await api.post(
        "/finds",
        json={
            "speciesId": str(species.id),
            "lat": 50.123456,
            "lon": 8.123456,
            "foundOn": "2026-09-01",
            "visibility": "shared",
        },
    )
    sign_in(app_of(api), bert)
    listed = await api.get("/finds", params={"mine": "false"})
    item = listed.json()["items"][0]
    assert item["lat"] != 50.123456
    assert item["lon"] != 8.123456


async def test_own_finds_stay_exact_for_a_protected_species(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session, "anna")
    species = await make_species(session, protection=Protection.STRICT)
    sign_in(app_of(api), user)
    await api.post(
        "/finds",
        json={
            "speciesId": str(species.id),
            "lat": 50.123456,
            "lon": 8.123456,
            "foundOn": "2026-09-01",
        },
    )
    listed = await api.get("/finds")
    item = listed.json()["items"][0]
    assert item["lat"] == 50.123456
    assert item["lon"] == 8.123456


async def test_species_filter(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    species = await make_species(session)
    sign_in(app_of(api), user)
    await api.post(
        "/finds",
        json={"speciesId": str(species.id), "lat": 1.0, "lon": 1.0, "foundOn": "2026-09-01"},
    )
    await api.post("/finds", json={"lat": 2.0, "lon": 2.0, "foundOn": "2026-09-01"})
    listed = await api.get("/finds", params={"speciesId": str(species.id)})
    assert len(listed.json()["items"]) == 1


async def test_bbox_filter(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    await api.post("/finds", json={"lat": 50.0, "lon": 8.0, "foundOn": "2026-09-01"})
    await api.post("/finds", json={"lat": 60.0, "lon": 20.0, "foundOn": "2026-09-01"})
    listed = await api.get("/finds", params={"bbox": "7,49,9,51"})
    assert len(listed.json()["items"]) == 1


async def test_invalid_bbox_is_422(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    listed = await api.get("/finds", params={"bbox": "not-a-bbox"})
    assert listed.status_code == 422


async def test_put_revives_a_deleted_find(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/finds", json={"lat": 1.0, "lon": 1.0, "foundOn": "2026-09-01"})
    find_id = created.json()["id"]
    await api.delete(f"/finds/{find_id}")
    revived = await api.put(
        f"/finds/{find_id}",
        json={"lat": 1.0, "lon": 1.0, "foundOn": "2026-09-01"},
    )
    assert revived.status_code == 201


async def test_review_requires_the_right(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/finds", json={"lat": 1.0, "lon": 1.0, "foundOn": "2026-09-01"})
    find_id = created.json()["id"]
    answer = await api.post(f"/finds/{find_id}/review", json={"decision": "accepted"})
    assert answer.status_code == 403


async def test_review_sets_state_and_reviewer(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session, "anna")
    reviewer = await make_user(session, "reviewer")
    sign_in(app_of(api), owner)
    created = await api.post("/finds", json={"lat": 1.0, "lon": 1.0, "foundOn": "2026-09-01"})
    find_id = created.json()["id"]
    sign_in(app_of(api), reviewer, "find.review")
    answer = await api.post(f"/finds/{find_id}/review", json={"decision": "rejected"})
    assert answer.status_code == 200
    body = answer.json()
    assert body["reviewState"] == "rejected"
    assert body["reviewedById"] == str(reviewer.id)
    assert body["reviewedAt"] is not None


async def test_review_of_missing_find_is_not_found(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    reviewer = await make_user(session, "reviewer")
    sign_in(app_of(api), reviewer, "find.review")
    answer = await api.post(
        f"/finds/{uuid.uuid4()}/review",
        json={"decision": "accepted"},
    )
    assert answer.status_code == 404


async def test_accept_all_open_finds(api: httpx.AsyncClient, session: AsyncSession) -> None:
    owner = await make_user(session, "anna")
    reviewer = await make_user(session, "reviewer")
    sign_in(app_of(api), owner)
    await api.post("/finds", json={"lat": 1.0, "lon": 1.0, "foundOn": "2026-09-01"})
    await api.post("/finds", json={"lat": 2.0, "lon": 2.0, "foundOn": "2026-09-01"})
    sign_in(app_of(api), reviewer, "find.review")
    answer = await api.post("/finds/reviews/accept-all")
    assert answer.status_code == 204
    listed = await api.get("/finds")
    assert all(item["reviewState"] == "accepted" for item in listed.json()["items"])


async def test_training_finds_filters_correctly(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session, "anna")
    reviewer = await make_user(session, "reviewer")
    species = await make_species(session)
    sign_in(app_of(api), owner)
    ready = await api.post(
        "/finds",
        json={
            "speciesId": str(species.id),
            "lat": 1.0,
            "lon": 1.0,
            "foundOn": "2026-09-01",
            "forTraining": True,
        },
    )
    await api.post(
        "/finds",
        json={"lat": 2.0, "lon": 2.0, "foundOn": "2026-09-01", "forTraining": True},
    )
    sign_in(app_of(api), reviewer, "find.review")
    await api.post(f"/finds/{ready.json()['id']}/review", json={"decision": "accepted"})
    rows = await find_service.FindService(session).training_finds()
    assert [row.id for row in rows] == [uuid.UUID(ready.json()["id"])]

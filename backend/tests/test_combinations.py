import json
import uuid

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from tests.conftest import app_of, make_user, sign_in

FACTOR = {"source": "boletus-edulis", "condition": "above", "low": 0.5}


def write_manifest(names: list[str]) -> None:
    folder = get_settings().maps
    folder.mkdir(parents=True, exist_ok=True)
    layers = {name: {"label": name, "unit": ""} for name in names}
    (folder / "layers.json").write_text(json.dumps({"layers": layers}), encoding="utf-8")


async def test_create_without_manifest_skips_the_check(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    answer = await api.post(
        "/combinations",
        json={"name": "Regel", "rule": "intersection", "factors": [FACTOR]},
    )
    assert answer.status_code == 201
    assert answer.json()["factors"][0]["source"] == "boletus-edulis"


async def test_create_rejects_an_unknown_source(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    write_manifest(["boletus-edulis"])
    answer = await api.post(
        "/combinations",
        json={
            "name": "Regel",
            "rule": "intersection",
            "factors": [FACTOR, {**FACTOR, "source": "x"}],
        },
    )
    assert answer.status_code == 422
    errors = answer.json()["errors"]
    assert errors == [{"field": "factors.1.source", "code": "unknown_source"}]


async def test_create_accepts_a_known_source(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    write_manifest(["boletus-edulis"])
    answer = await api.post(
        "/combinations",
        json={"name": "Regel", "rule": "intersection", "factors": [FACTOR]},
    )
    assert answer.status_code == 201


async def test_put_replaces_a_combination(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    combination_id = str(uuid.uuid4())
    first = await api.put(
        f"/combinations/{combination_id}",
        json={"name": "Alt", "rule": "intersection", "factors": [FACTOR]},
    )
    assert first.status_code == 201
    second = await api.put(
        f"/combinations/{combination_id}",
        json={"name": "Neu", "rule": "graded", "factors": [FACTOR]},
    )
    assert second.status_code == 200
    assert second.json()["name"] == "Neu"
    assert second.json()["rule"] == "graded"


async def test_put_rejects_an_unknown_source(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    write_manifest(["boletus-edulis"])
    combination_id = str(uuid.uuid4())
    answer = await api.put(
        f"/combinations/{combination_id}",
        json={"name": "Regel", "rule": "intersection", "factors": [{**FACTOR, "source": "x"}]},
    )
    assert answer.status_code == 422


async def test_delete_a_combination(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post(
        "/combinations",
        json={"name": "Regel", "rule": "intersection", "factors": [FACTOR]},
    )
    combination_id = created.json()["id"]
    deleted = await api.delete(f"/combinations/{combination_id}")
    assert deleted.status_code == 204
    assert (await api.get(f"/combinations/{combination_id}")).status_code == 404


async def test_list_requires_login(api: httpx.AsyncClient) -> None:
    assert (await api.get("/combinations")).status_code == 401


async def test_get_a_combination(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post(
        "/combinations",
        json={"name": "Regel", "rule": "intersection", "factors": [FACTOR]},
    )
    fetched = await api.get(f"/combinations/{created.json()['id']}")
    assert fetched.status_code == 200


async def test_list_and_changes_since(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post(
        "/combinations",
        json={"name": "Regel", "rule": "intersection", "factors": [FACTOR]},
    )
    listed = await api.get("/combinations")
    assert len(listed.json()["items"]) == 1
    since_list = await api.get("/combinations", params={"since": "1970-01-01T00:00:00Z"})
    ids = {item["id"] for item in since_list.json()["items"]}
    assert created.json()["id"] in ids

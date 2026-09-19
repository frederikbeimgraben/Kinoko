import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import app_of, make_user, sign_in

ENTRY = {"term": "Hymenium", "definition": "Die Fruchtschicht eines Pilzes."}


async def test_list_is_open_to_everyone(api: httpx.AsyncClient) -> None:
    listed = await api.get("/glossary")
    assert listed.status_code == 200
    assert listed.json() == {"items": []}


async def test_create_needs_the_right(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna)
    assert (await api.post("/glossary", json=ENTRY)).status_code == 403


async def test_create_read_and_delete(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna, "text.edit")
    made = await api.post("/glossary", json=ENTRY)
    assert made.status_code == 201
    body = made.json()
    assert body["term"] == "Hymenium"
    assert body["updatedByName"] == "anna"
    listed = await api.get("/glossary")
    assert [item["id"] for item in listed.json()["items"]] == [body["id"]]
    assert (await api.delete(f"/glossary/{body['id']}")).status_code == 204
    assert (await api.get("/glossary")).json()["items"] == []


async def test_update_changes_the_definition(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna, "text.edit")
    made = (await api.post("/glossary", json=ENTRY)).json()
    changed = await api.put(f"/glossary/{made['id']}", json={**ENTRY, "definition": "Kurz."})
    assert changed.json()["definition"] == "Kurz."


async def test_a_term_stands_once(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna, "text.edit")
    first = (await api.post("/glossary", json=ENTRY)).json()
    assert (await api.post("/glossary", json=ENTRY)).status_code == 422
    other = await api.post("/glossary", json={**ENTRY, "term": "Stiel"})
    clash = await api.put(f"/glossary/{other.json()['id']}", json=ENTRY)
    assert clash.status_code == 422
    same = await api.put(f"/glossary/{first['id']}", json=ENTRY)
    assert same.status_code == 200


async def test_an_unknown_entry(api: httpx.AsyncClient, session: AsyncSession) -> None:
    anna = await make_user(session, "anna")
    sign_in(app_of(api), anna, "text.edit")
    missing = "11111111-1111-1111-1111-111111111111"
    assert (await api.put(f"/glossary/{missing}", json=ENTRY)).status_code == 404
    assert (await api.delete(f"/glossary/{missing}")).status_code == 404

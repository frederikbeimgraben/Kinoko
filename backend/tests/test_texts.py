import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.models import TextEntry
from app.modules.texts import service
from tests.conftest import app_of, make_user, sign_in


async def test_sync_writes_only_missing_keys(session: AsyncSession, schema: None) -> None:  # noqa: ARG001
    first = await service.sync(session)
    assert first > 0
    assert await service.sync(session) == 0


async def test_sync_keeps_a_changed_text(session: AsyncSession, seeded: None) -> None:  # noqa: ARG001
    row = (await session.execute(select(TextEntry).limit(1))).scalar_one()
    row.value = "Von Hand"
    row.changed = True
    await session.commit()
    await service.sync(session)
    await session.refresh(row)
    assert row.value == "Von Hand"


async def test_catalogue_has_both_locales(api: httpx.AsyncClient) -> None:
    answer = await api.get("/texts")
    assert answer.status_code == 200
    body = answer.json()
    assert body["locales"] == ["de", "en"]
    assert body["revision"]
    keys = {entry["key"] for entry in body["entries"]}
    assert "error.notFound" in keys
    assert all(not entry["changed"] for entry in body["entries"])


async def test_etag_answers_304(api: httpx.AsyncClient) -> None:
    first = await api.get("/texts")
    tag = first.headers["etag"]
    again = await api.get("/texts", headers={"If-None-Match": tag})
    assert again.status_code == 304


async def test_put_needs_the_right(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "redaktion")
    sign_in(app_of(api), user)
    answer = await api.put("/texts/common.save", json={"locale": "de", "value": "Sichern"})
    assert answer.status_code == 403


async def test_put_and_reset(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "redaktion")
    sign_in(app_of(api), user, "text.edit")
    answer = await api.put("/texts/common.save", json={"locale": "de", "value": "Sichern"})
    assert answer.status_code == 200
    assert answer.json()["values"]["de"] == "Sichern"
    assert answer.json()["changed"] is True
    back = await api.delete("/texts/common.save", params={"locale": "de"})
    assert back.status_code == 204
    again = await api.get("/texts")
    entry = next(e for e in again.json()["entries"] if e["key"] == "common.save")
    assert entry["changed"] is False


async def test_unknown_key_is_not_found(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "redaktion")
    sign_in(app_of(api), user, "text.edit")
    missing = await api.put("/texts/gibt.es.nicht", json={"locale": "de", "value": "x"})
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"
    assert (await api.delete("/texts/gibt.es.nicht", params={"locale": "de"})).status_code == 404


async def test_new_locale_of_a_known_key(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "redaktion")
    sign_in(app_of(api), user, "text.edit")
    answer = await api.put("/texts/common.save", json={"locale": "fr", "value": "Enregistrer"})
    assert answer.json()["values"]["fr"] == "Enregistrer"
    back = await api.delete("/texts/common.save", params={"locale": "fr"})
    assert back.status_code == 204


async def test_entry_of_unknown_key_raises(session: AsyncSession, seeded: None) -> None:  # noqa: ARG001
    with pytest.raises(NotFound):
        service.entry_of(await service.entries(session), "gibt.es.nicht")


async def test_titles_reach_the_errors(api: httpx.AsyncClient) -> None:
    answer = await api.get("/nirgendwo")
    assert answer.json()["title"] == "Nicht gefunden"

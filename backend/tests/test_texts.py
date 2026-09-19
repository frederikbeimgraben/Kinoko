import json
from pathlib import Path

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.models import TextEntry
from app.modules.texts.seed import TextSeed
from app.modules.texts.service import TextService
from tests.conftest import app_of, make_user, sign_in


def wanted() -> set[tuple[str, str]]:
    """Jeder Schlüssel der Vorgabe, je Sprache."""
    raw = json.loads(TextSeed.SOURCE.read_text(encoding="utf-8"))
    return {(key, locale) for locale, entries in raw.items() for key in entries}


async def test_seed_writes_every_key_of_the_file(session: AsyncSession, schema: None) -> None:  # noqa: ARG001
    added = await TextSeed().sync(session)

    rows = (await session.execute(select(TextEntry))).scalars()
    assert {(row.key, row.locale) for row in rows} == wanted()
    assert added.added == len(wanted())


async def test_sync_writes_only_missing_keys(session: AsyncSession, schema: None) -> None:  # noqa: ARG001
    first = await TextSeed().sync(session)
    assert first.added > 0
    assert (await TextSeed().sync(session)).touched == 0


async def test_catalogue_holds_the_whole_file(api: httpx.AsyncClient) -> None:
    answer = await api.get("/texts")

    assert answer.status_code == 200
    body = answer.json()
    pairs = {(entry["key"], locale) for entry in body["entries"] for locale in entry["values"]}
    assert pairs == wanted()
    assert answer.headers["etag"]


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
    assert again.headers["etag"] == tag


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


async def test_change_of_unknown_key_raises(session: AsyncSession, seeded: None) -> None:  # noqa: ARG001
    with pytest.raises(NotFound):
        await TextService(session).reset("gibt.es.nicht", "de")


async def test_titles_reach_the_errors(api: httpx.AsyncClient) -> None:
    answer = await api.get("/nirgendwo")
    assert answer.json()["title"] == "Nicht gefunden"


def with_source(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, data: dict[str, dict[str, str]]
) -> None:
    """Legt eine eigene Vorgabe unter den Seed."""
    file = tmp_path / "texte.json"
    file.write_text(json.dumps(data), encoding="utf-8")
    monkeypatch.setattr(TextSeed, "SOURCE", file)


async def test_sync_follows_a_changed_default(
    session: AsyncSession,
    schema: None,  # noqa: ARG001
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    with_source(monkeypatch, tmp_path, {"de": {"admin.size": "Maße"}})
    await TextSeed().sync(session)
    before = TextService(session).revision(await TextService(session).entries())

    with_source(monkeypatch, tmp_path, {"de": {"admin.size": "Abmessungen"}})
    report = await TextSeed().sync(session)

    row = (await session.execute(select(TextEntry))).scalar_one()
    assert row.value == "Abmessungen"
    assert row.updated_by_id is None
    assert (report.added, report.updated, report.removed) == (0, 1, 0)
    assert TextService(session).revision(await TextService(session).entries()) != before


async def test_sync_leaves_a_text_changed_by_hand(
    session: AsyncSession,
    schema: None,  # noqa: ARG001
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    with_source(monkeypatch, tmp_path, {"de": {"admin.size": "Maße"}})
    await TextSeed().sync(session)
    user = await make_user(session, "redaktion")
    row = (await session.execute(select(TextEntry))).scalar_one()
    row.value = "Von Hand"
    row.updated_by_id = user.id
    await session.commit()

    with_source(monkeypatch, tmp_path, {"de": {"admin.size": "Abmessungen"}})
    report = await TextSeed().sync(session)

    await session.refresh(row)
    assert row.value == "Von Hand"
    assert report.updated == 0


async def test_sync_removes_an_orphan_that_nobody_changed(
    session: AsyncSession,
    schema: None,  # noqa: ARG001
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    with_source(monkeypatch, tmp_path, {"de": {"admin.size": "Maße", "admin.gone": "Weg"}})
    await TextSeed().sync(session)

    with_source(monkeypatch, tmp_path, {"de": {"admin.size": "Maße"}})
    report = await TextSeed().sync(session)

    rows = (await session.execute(select(TextEntry))).scalars()
    assert {row.key for row in rows} == {"admin.size"}
    assert (report.added, report.updated, report.removed) == (0, 0, 1)


async def test_sync_keeps_an_orphan_changed_by_hand(
    session: AsyncSession,
    schema: None,  # noqa: ARG001
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    with_source(monkeypatch, tmp_path, {"de": {"admin.gone": "Weg"}})
    await TextSeed().sync(session)
    user = await make_user(session, "redaktion")
    row = (await session.execute(select(TextEntry))).scalar_one()
    row.updated_by_id = user.id
    await session.commit()

    with_source(monkeypatch, tmp_path, {"de": {}})
    report = await TextSeed().sync(session)

    rows = (await session.execute(select(TextEntry))).scalars()
    assert {row.key for row in rows} == {"admin.gone"}
    assert report.removed == 0

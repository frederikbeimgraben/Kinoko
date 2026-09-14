"""Der Katalogimport beim App-Start."""

from __future__ import annotations

from typing import TYPE_CHECKING

import httpx
from sqlalchemy import func, select

from app.main import build_app, lifespan
from app.models import Species
from app.modules.catalog import seed as catalog_seed

if TYPE_CHECKING:
    import pytest
    from sqlalchemy.ext.asyncio import AsyncSession


async def test_start_imports_the_catalog_into_an_empty_database(schema: None) -> None:  # noqa: ARG001
    built = build_app()
    async with (
        lifespan(built),
        httpx.AsyncClient(
            transport=httpx.ASGITransport(app=built), base_url="http://test/api"
        ) as client,
    ):
        total = 0
        cursor: str | None = None
        while True:
            params = {"limit": 40, **({"cursor": cursor} if cursor else {})}
            answer = await client.get("/species", params=params)
            assert answer.status_code == 200
            body = answer.json()
            total += len(body["items"])
            cursor = body["nextCursor"]
            if cursor is None:
                break
        assert total == 306


async def test_sync_does_not_reimport_when_species_exist(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    await catalog_seed.sync(session)
    before = (await session.execute(select(func.count()).select_from(Species))).scalar_one()

    calls = 0

    async def fail_if_called(*_args: object, **_kwargs: object) -> None:
        nonlocal calls
        calls += 1

    monkeypatch.setattr(catalog_seed, "import_all", fail_if_called)
    await catalog_seed.sync(session)

    after = (await session.execute(select(func.count()).select_from(Species))).scalar_one()
    assert after == before
    assert calls == 0

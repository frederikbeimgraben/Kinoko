"""Der Katalogimport beim App-Start."""

from __future__ import annotations

import httpx

from app.main import build_app, lifespan


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

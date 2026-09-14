"""Tests des Bündels: ETag, Standardfarben, Achsen."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.shared.enums import BodyPart, ColourMode
from tests import catalog_factory as cf

if TYPE_CHECKING:
    import httpx
    from sqlalchemy.ext.asyncio import AsyncSession


async def test_bundle_has_items_standard_colours_and_facets(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    porcini = await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    await cf.add_colours(
        session,
        porcini,
        part=BodyPart.CAP,
        mode=ColourMode.DISTINCT,
        colours=[("braun", "#7a5230")],
    )
    response = await api.get("/species/bundle")
    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["slug"] == porcini.slug
    assert len(body["standardColours"]) == 12
    assert body["facets"]["colours"]["cap"] == ["brown"]
    assert "ETag" in response.headers


async def test_bundle_returns_304_for_matching_etag(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    first = await api.get("/species/bundle")
    tag = first.headers["ETag"]
    second = await api.get("/species/bundle", headers={"If-None-Match": tag})
    assert second.status_code == 304
    assert second.content == b""


async def test_bundle_etag_changes_after_write(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    first = await api.get("/species/bundle")
    tag = first.headers["ETag"]
    await cf.make_species(
        session, slug="boletus-badius", name="Maronenröhrling", latin_name="Boletus badius"
    )
    second = await api.get("/species/bundle", headers={"If-None-Match": tag})
    assert second.status_code == 200
    assert second.headers["ETag"] != tag


async def test_bundle_empty_catalogue(api: httpx.AsyncClient) -> None:
    response = await api.get("/species/bundle")
    assert response.status_code == 200
    assert response.json()["items"] == []

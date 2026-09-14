"""Tests der Artenliste: Suche, Achsen, Farbe, Maß, Blättern."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.shared.enums import (
    BodyPart,
    CapShape,
    ColourMode,
    Dimension,
    Edibility,
    HymeniumType,
    NameKind,
    TaxonRank,
    TermKind,
)
from tests import catalog_factory as cf

if TYPE_CHECKING:
    import httpx
    from sqlalchemy.ext.asyncio import AsyncSession


async def _seed(session: AsyncSession) -> dict[str, Any]:
    genus = await cf.make_taxon(session, rank=TaxonRank.GENUS, slug="boletus", name="Boletus")
    other_genus = await cf.make_taxon(session, rank=TaxonRank.GENUS, slug="amanita", name="Amanita")
    porcini = await cf.make_species(
        session,
        slug="boletus-edulis",
        name="Steinpilz",
        latin_name="Boletus edulis",
        taxon=genus,
        edibility=Edibility.EDIBLE,
        hymenium_type=HymeniumType.TUBES,
        cap_shape_young=CapShape.HEMISPHERICAL,
        cap_shape_old=CapShape.CONVEX,
        period_start_month=6,
        period_end_month=10,
    )
    await cf.add_colours(
        session,
        porcini,
        part=BodyPart.CAP,
        mode=ColourMode.DISTINCT,
        colours=[("braun", "#7a5230")],
    )
    await cf.add_measurement(
        session, porcini, part=BodyPart.CAP, dimension=Dimension.WIDTH, low=4.0, high=10.0
    )
    await cf.add_name(session, porcini, 0, "Herrenpilz", NameKind.SYNONYM)

    fly = await cf.make_species(
        session,
        slug="amanita-muscaria",
        name="Fliegenpilz",
        latin_name="Amanita muscaria",
        taxon=other_genus,
        edibility=Edibility.POISONOUS,
        hymenium_type=HymeniumType.GILLS,
        cap_shape_young=CapShape.SPHERICAL,
        cap_shape_old=CapShape.FLAT,
        period_start_month=11,
        period_end_month=2,
    )
    await cf.add_colours(
        session,
        fly,
        part=BodyPart.CAP,
        mode=ColourMode.DISTINCT,
        colours=[("rot", "#c0392b")],
    )
    await cf.add_measurement(
        session, fly, part=BodyPart.CAP, dimension=Dimension.WIDTH, low=8.0, high=20.0
    )

    term = await cf.make_term(session, kind=TermKind.SMELL, slug="fruity", name="fruchtig")
    await cf.add_term(session, porcini, term)

    return {"porcini": porcini, "fly": fly, "genus": genus, "term": term}


async def test_search_matches_name_latin_name_and_further_name(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    seed = await _seed(session)
    response = await api.get("/species", params={"q": "Herrenpilz"})
    assert response.status_code == 200
    slugs = {item["slug"] for item in response.json()["items"]}
    assert slugs == {seed["porcini"].slug}

    response = await api.get("/species", params={"q": "amanita"})
    assert {item["slug"] for item in response.json()["items"]} == {seed["fly"].slug}


async def test_taxon_id_filters_by_subtree(session: AsyncSession, api: httpx.AsyncClient) -> None:
    seed = await _seed(session)
    response = await api.get("/species", params={"taxonId": str(seed["genus"].id)})
    assert {item["slug"] for item in response.json()["items"]} == {seed["porcini"].slug}


async def test_edibility_and_hymenium_and_cap_shape_axes(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    seed = await _seed(session)
    response = await api.get("/species", params={"edibility[]": ["edible", "poisonous"]})
    assert {item["slug"] for item in response.json()["items"]} == {
        seed["porcini"].slug,
        seed["fly"].slug,
    }

    response = await api.get("/species", params={"hymenium[]": ["tubes"]})
    assert {item["slug"] for item in response.json()["items"]} == {seed["porcini"].slug}

    response = await api.get("/species", params={"capShape[]": ["flat"]})
    assert {item["slug"] for item in response.json()["items"]} == {seed["fly"].slug}


async def test_axes_combine_with_and(session: AsyncSession, api: httpx.AsyncClient) -> None:
    await _seed(session)
    response = await api.get(
        "/species", params={"edibility[]": ["poisonous"], "hymenium[]": ["tubes"]}
    )
    assert response.json()["items"] == []


async def test_terms_require_all(session: AsyncSession, api: httpx.AsyncClient) -> None:
    seed = await _seed(session)
    other_term = await cf.make_term(session, kind=TermKind.SMELL, slug="musty", name="modrig")
    response = await api.get("/species", params={"terms[]": [str(seed["term"].id)]})
    assert {item["slug"] for item in response.json()["items"]} == {seed["porcini"].slug}

    response = await api.get(
        "/species", params={"terms[]": [str(seed["term"].id), str(other_term.id)]}
    )
    assert response.json()["items"] == []


async def test_months_wraps_year(session: AsyncSession, api: httpx.AsyncClient) -> None:
    seed = await _seed(session)
    response = await api.get("/species", params={"months[]": [12]})
    assert {item["slug"] for item in response.json()["items"]} == {seed["fly"].slug}

    response = await api.get("/species", params={"months[]": [7]})
    assert {item["slug"] for item in response.json()["items"]} == {seed["porcini"].slug}


async def test_colour_filter_uses_nearest_standard_colour(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    seed = await _seed(session)
    response = await api.get("/species", params={"colour[cap]": "#7a5230"})
    assert {item["slug"] for item in response.json()["items"]} == {seed["porcini"].slug}


async def test_colour_filter_rejects_malformed_hex(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    await _seed(session)
    response = await api.get("/species", params={"colour[cap]": "not-a-hex"})
    assert response.status_code == 422


async def test_size_filter_matches_overlapping_range(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    seed = await _seed(session)
    response = await api.get("/species", params={"size[cap.width]": "1-5"})
    assert {item["slug"] for item in response.json()["items"]} == {seed["porcini"].slug}

    response = await api.get("/species", params={"size[cap.width]": "15-"})
    assert {item["slug"] for item in response.json()["items"]} == {seed["fly"].slug}

    response = await api.get("/species", params={"size[cap.width]": "-3"})
    assert response.json()["items"] == []


async def test_size_filter_rejects_bad_key(session: AsyncSession, api: httpx.AsyncClient) -> None:
    await _seed(session)
    response = await api.get("/species", params={"size[cap.unknown]": "1-2"})
    assert response.status_code == 422


async def test_size_filter_rejects_bad_range(session: AsyncSession, api: httpx.AsyncClient) -> None:
    await _seed(session)
    response = await api.get("/species", params={"size[cap.width]": "not-a-range"})
    assert response.status_code == 422


async def test_list_orders_by_name(session: AsyncSession, api: httpx.AsyncClient) -> None:
    await _seed(session)
    response = await api.get("/species")
    names = [item["name"] for item in response.json()["items"]]
    assert names == sorted(names)


async def test_pagination_limit_and_cursor(session: AsyncSession, api: httpx.AsyncClient) -> None:
    await _seed(session)
    first = await api.get("/species", params={"limit": 1})
    body = first.json()
    assert len(body["items"]) == 1
    assert body["nextCursor"] is not None

    second = await api.get("/species", params={"limit": 1, "cursor": body["nextCursor"]})
    second_body = second.json()
    assert len(second_body["items"]) == 1
    assert second_body["nextCursor"] is None
    assert second_body["items"][0]["slug"] != body["items"][0]["slug"]


async def test_pagination_limit_over_forty_rejected(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    await _seed(session)
    response = await api.get("/species", params={"limit": 41})
    assert response.status_code == 422


async def test_lead_photo_id_in_summary(session: AsyncSession, api: httpx.AsyncClient) -> None:
    seed = await _seed(session)
    photo = await cf.add_lead_photo(session, seed["porcini"])
    response = await api.get("/species", params={"q": "Steinpilz"})
    item = response.json()["items"][0]
    assert item["leadPhotoId"] == str(photo.id)

"""Tests des Bündels: ETag, Standardfarben, Achsen."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.shared.enums import BodyPart, ColourMode, Edibility, HymeniumType, TaxonRank, TermKind
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
    assert body["standardColours"][0] == {"key": "white", "hex": "#f3efe6"}
    assert body["facets"]["colour.cap"] == {"brown": 1}
    assert "ETag" in response.headers


async def test_facets_count_every_axis(session: AsyncSession, api: httpx.AsyncClient) -> None:
    family = await cf.make_taxon(
        session, rank=TaxonRank.FAMILY, slug="boletaceae", name="Boletaceae"
    )
    genus = await cf.make_taxon(
        session, rank=TaxonRank.GENUS, slug="boletus", name="Boletus", parent=family
    )
    porcini = await cf.make_species(
        session,
        slug="boletus-edulis",
        name="Steinpilz",
        latin_name="Boletus edulis",
        taxon=genus,
        hymenium_type=HymeniumType.TUBES,
        period_start_month=8,
        period_end_month=10,
    )
    await cf.make_species(
        session, slug="amanita-phalloides", name="Knollenblätterpilz", edibility=Edibility.DEADLY
    )
    spruce = await cf.make_term(session, kind=TermKind.TREE, slug="fichte", name="Fichte")
    await cf.add_term(session, porcini, spruce)

    facets = (await api.get("/species/bundle")).json()["facets"]

    assert facets["edibility"] == {"edible": 1, "deadly": 1}
    assert facets["hymenium"] == {"tubes": 1}
    assert facets["period"]["9"] == 1
    assert facets["treePartner"] == {"fichte": 1}
    assert facets["genusFamily"] == {"Boletus": 1, "Boletaceae": 1}
    assert facets["unknown"]["hymenium"] == 1


async def test_bundle_names_genus_and_family(session: AsyncSession, api: httpx.AsyncClient) -> None:
    family = await cf.make_taxon(
        session, rank=TaxonRank.FAMILY, slug="boletaceae", name="Boletaceae"
    )
    genus = await cf.make_taxon(
        session, rank=TaxonRank.GENUS, slug="boletus", name="Boletus", parent=family
    )
    await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis", taxon=genus
    )

    item = (await api.get("/species/bundle")).json()["items"][0]

    assert item["genusName"] == "Boletus"
    assert item["familyName"] == "Boletaceae"


async def test_a_species_without_a_taxon_names_its_genus_from_the_latin_name(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )

    item = (await api.get("/species/bundle")).json()["items"][0]

    assert item["genusName"] == "Boletus"
    assert item["familyName"] is None


async def test_a_term_names_its_kind(session: AsyncSession, api: httpx.AsyncClient) -> None:
    porcini = await cf.make_species(session, slug="boletus-edulis", name="Steinpilz")
    spruce = await cf.make_term(session, kind=TermKind.TREE, slug="fichte", name="Fichte")
    await cf.add_term(session, porcini, spruce)

    item = (await api.get("/species/bundle")).json()["items"][0]

    assert item["terms"][0]["term"]["kind"] == "tree"


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

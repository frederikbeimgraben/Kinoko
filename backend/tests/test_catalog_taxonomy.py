"""Tests der Taxonseite: Weg, Nachbarn, Kinder, Arten."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.shared.enums import TaxonRank
from tests import catalog_factory as cf

if TYPE_CHECKING:
    import httpx
    from sqlalchemy.ext.asyncio import AsyncSession


async def _seed(session: AsyncSession) -> dict[str, Any]:
    division = await cf.make_taxon(session, rank=TaxonRank.DIVISION, slug="basidiomycota")
    order = await cf.make_taxon(session, rank=TaxonRank.ORDER, slug="boletales", parent=division)
    family = await cf.make_taxon(session, rank=TaxonRank.FAMILY, slug="boletaceae", parent=order)
    sibling_family = await cf.make_taxon(
        session, rank=TaxonRank.FAMILY, slug="paxillaceae", parent=order
    )
    genus = await cf.make_taxon(session, rank=TaxonRank.GENUS, slug="boletus", parent=family)
    other_genus = await cf.make_taxon(session, rank=TaxonRank.GENUS, slug="suillus", parent=family)
    porcini = await cf.make_species(
        session,
        slug="boletus-edulis",
        name="Steinpilz",
        latin_name="Boletus edulis",
        taxon=genus,
    )
    jack = await cf.make_species(
        session,
        slug="suillus-luteus",
        name="Butterpilz",
        latin_name="Suillus luteus",
        taxon=other_genus,
    )
    return {
        "division": division,
        "order": order,
        "family": family,
        "sibling_family": sibling_family,
        "genus": genus,
        "other_genus": other_genus,
        "porcini": porcini,
        "jack": jack,
    }


async def test_genus_page_has_its_own_species(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    seed = await _seed(session)
    genus = seed["genus"]
    response = await api.get(f"/taxa/{genus.rank.value}/{genus.slug}")
    assert response.status_code == 200
    body = response.json()
    assert body["speciesCount"] == 1
    assert body["species"][0]["slug"] == seed["porcini"].slug
    assert body["children"] == []


async def test_family_page_collects_species_across_genera(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    seed = await _seed(session)
    family = seed["family"]
    response = await api.get(f"/taxa/{family.rank.value}/{family.slug}")
    body = response.json()
    assert body["speciesCount"] == 2
    slugs = {item["slug"] for item in body["species"]}
    assert slugs == {seed["porcini"].slug, seed["jack"].slug}
    child_counts = {child["slug"]: child["speciesCount"] for child in body["children"]}
    assert child_counts == {"boletus": 1, "suillus": 1}


async def test_family_page_has_path_and_siblings(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    seed = await _seed(session)
    family = seed["family"]
    response = await api.get(f"/taxa/{family.rank.value}/{family.slug}")
    body = response.json()
    path_slugs = [step["slug"] for step in body["path"]]
    assert path_slugs == [seed["division"].slug, seed["order"].slug]
    sibling_slugs = {step["slug"] for step in body["siblings"]}
    assert sibling_slugs == {seed["sibling_family"].slug}


async def test_division_page_has_empty_path(session: AsyncSession, api: httpx.AsyncClient) -> None:
    seed = await _seed(session)
    division = seed["division"]
    response = await api.get(f"/taxa/{division.rank.value}/{division.slug}")
    body = response.json()
    assert body["path"] == []
    assert body["siblings"] == []


async def test_taxon_page_404(api: httpx.AsyncClient) -> None:
    response = await api.get("/taxa/genus/unknown-genus")
    assert response.status_code == 404

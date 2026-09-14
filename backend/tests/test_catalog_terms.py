"""Tests der Begriffe: lesen, anlegen, ändern, verschmelzen."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.shared.enums import BodyPart, TermKind, TriggerGroup
from tests import catalog_factory as cf
from tests.conftest import app_of, make_user, sign_in, sign_out

if TYPE_CHECKING:
    import httpx
    from sqlalchemy.ext.asyncio import AsyncSession


async def test_list_terms_ordered_by_position_and_name(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    await cf.make_term(session, kind=TermKind.SMELL, slug="b", name="B", position=1)
    await cf.make_term(session, kind=TermKind.SMELL, slug="a", name="A", position=0)
    await cf.make_term(session, kind=TermKind.TASTE, slug="c", name="C", position=0)
    response = await api.get("/terms", params={"kind": "smell"})
    assert response.status_code == 200
    slugs = [item["slug"] for item in response.json()["items"]]
    assert slugs == ["a", "b"]


async def test_list_terms_without_kind_returns_all(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    await cf.make_term(session, kind=TermKind.SMELL, slug="a", name="A")
    await cf.make_term(session, kind=TermKind.TASTE, slug="b", name="B")
    response = await api.get("/terms")
    assert len(response.json()["items"]) == 2


async def test_create_term_requires_permission(api: httpx.AsyncClient) -> None:
    response = await api.post("/terms", json={"kind": "smell", "slug": "a", "name": "A"})
    assert response.status_code == 401


async def test_create_term_success(session: AsyncSession, api: httpx.AsyncClient) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.post(
        "/terms", json={"kind": "smell", "slug": "fruity", "name": "fruchtig"}
    )
    sign_out(app_of(api))
    assert response.status_code == 201
    assert response.json()["slug"] == "fruity"


async def test_create_term_duplicate_slug_within_kind_conflicts(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    await cf.make_term(session, kind=TermKind.SMELL, slug="fruity", name="fruchtig")
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.post("/terms", json={"kind": "smell", "slug": "fruity", "name": "anders"})
    sign_out(app_of(api))
    assert response.status_code == 409
    assert response.json()["code"] == "slug_taken"


async def test_create_term_same_slug_different_kind_is_allowed(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    await cf.make_term(session, kind=TermKind.SMELL, slug="fruity", name="fruchtig")
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.post(
        "/terms", json={"kind": "taste", "slug": "fruity", "name": "fruchtig"}
    )
    sign_out(app_of(api))
    assert response.status_code == 201


async def test_update_term_changes_name_group_position(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    term = await cf.make_term(
        session, kind=TermKind.TRIGGER, slug="cut", name="Anschnitt", position=0
    )
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.patch(
        f"/terms/{term.id}",
        json={"name": "Anschnitt frisch", "group": "mechanical", "position": 3},
    )
    sign_out(app_of(api))
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Anschnitt frisch"
    assert body["group"] == "mechanical"
    assert body["position"] == 3


async def test_update_term_partial_leaves_other_fields(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    term = await cf.make_term(
        session,
        kind=TermKind.TRIGGER,
        slug="cut",
        name="Anschnitt",
        group=TriggerGroup.MECHANICAL,
        position=2,
    )
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.patch(f"/terms/{term.id}", json={"position": 5})
    sign_out(app_of(api))
    body = response.json()
    assert body["name"] == "Anschnitt"
    assert body["group"] == "mechanical"
    assert body["position"] == 5


async def test_update_term_404(session: AsyncSession, api: httpx.AsyncClient) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.patch(
        "/terms/00000000-0000-0000-0000-000000000000",
        json={"position": 1},
    )
    sign_out(app_of(api))
    assert response.status_code == 404


async def test_merge_term_self_is_invalid(session: AsyncSession, api: httpx.AsyncClient) -> None:
    term = await cf.make_term(session, kind=TermKind.SMELL, slug="fruity", name="fruchtig")
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.post(f"/terms/{term.id}/merge", json={"into": str(term.id)})
    sign_out(app_of(api))
    assert response.status_code == 422


async def test_merge_term_moves_species_and_trigger_usage(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    source = await cf.make_term(session, kind=TermKind.SMELL, slug="musty", name="modrig")
    target = await cf.make_term(session, kind=TermKind.SMELL, slug="mouldy", name="muffig")
    porcini = await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    bay = await cf.make_species(
        session, slug="boletus-badius", name="Maronenröhrling", latin_name="Boletus badius"
    )
    await cf.add_term(session, porcini, source)
    await cf.add_term(session, bay, source)
    await cf.add_term(session, bay, target)
    await cf.add_colour_change(
        session,
        porcini,
        position=0,
        part=BodyPart.FLESH,
        kind=TriggerGroup.MECHANICAL,
        to_name="blau",
        to_hex="#3a6ea8",
        triggers=[source],
    )
    await cf.add_colour_change(
        session,
        bay,
        position=0,
        part=BodyPart.FLESH,
        kind=TriggerGroup.MECHANICAL,
        to_name="blau",
        to_hex="#3a6ea8",
        triggers=[source, target],
    )

    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.post(f"/terms/{source.id}/merge", json={"into": str(target.id)})
    sign_out(app_of(api))
    assert response.status_code == 204

    porcini_profile = await api.get(f"/species/{porcini.slug}")
    porcini_term_slugs = {entry["term"]["slug"] for entry in porcini_profile.json()["terms"]}
    assert porcini_term_slugs == {"mouldy"}
    assert porcini_profile.json()["colourChanges"][0]["triggers"][0]["slug"] == "mouldy"

    bay_profile = await api.get(f"/species/{bay.slug}")
    bay_term_slugs = {entry["term"]["slug"] for entry in bay_profile.json()["terms"]}
    assert bay_term_slugs == {"mouldy"}
    bay_triggers = {t["slug"] for t in bay_profile.json()["colourChanges"][0]["triggers"]}
    assert bay_triggers == {"mouldy"}

    gone = await api.get("/terms", params={"kind": "smell"})
    assert {item["slug"] for item in gone.json()["items"]} == {"mouldy"}


async def test_merge_term_404(session: AsyncSession, api: httpx.AsyncClient) -> None:
    term = await cf.make_term(session, kind=TermKind.SMELL, slug="fruity", name="fruchtig")
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.post(
        f"/terms/{term.id}/merge",
        json={"into": "00000000-0000-0000-0000-000000000000"},
    )
    sign_out(app_of(api))
    assert response.status_code == 404

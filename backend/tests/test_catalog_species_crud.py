"""Tests der Art: Profil, Anlegen, Ersetzen, Löschen, Prognose, Zahlen."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, Any

from app.shared.enums import (
    BodyPart,
    CapFeature,
    CapMargin,
    ColourMode,
    Dimension,
    Edibility,
    Group,
    NameKind,
    Phase,
    Protection,
    Season,
    SourceScope,
    StemFeature,
    TermKind,
)
from tests import catalog_factory as cf
from tests.conftest import app_of, make_user, sign_in, sign_out
from tests.objects_support import make_species as make_find_species

if TYPE_CHECKING:
    import httpx
    from sqlalchemy.ext.asyncio import AsyncSession


async def test_get_species_profile_assembles_all_child_rows(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    porcini = await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    bay = await cf.make_species(
        session, slug="boletus-badius", name="Maronenröhrling", latin_name="Boletus badius"
    )
    await cf.add_name(session, porcini, 0, "Herrenpilz", NameKind.SYNONYM)
    await cf.add_measurement(
        session, porcini, part=BodyPart.CAP, dimension=Dimension.WIDTH, low=4.0, high=20.0
    )
    await cf.add_colours(
        session,
        porcini,
        part=BodyPart.CAP,
        mode=ColourMode.DISTINCT,
        colours=[("braun", "#7a5230")],
    )
    trigger = await cf.make_term(session, kind=TermKind.TRIGGER, slug="cut", name="Anschnitt")
    await cf.add_colour_change(
        session,
        porcini,
        position=0,
        part=BodyPart.FLESH,
        to_name="blau",
        to_hex="#3a6ea8",
        triggers=[trigger],
    )
    await cf.add_part_feature(
        session, porcini, part=BodyPart.CAP, feature=CapFeature.UMBONATE, phase=Phase.YOUNG
    )
    await cf.add_part_feature(
        session, porcini, part=BodyPart.CAP, feature=CapMargin.INROLLED, phase=Phase.YOUNG
    )
    await cf.add_part_feature(
        session, porcini, part=BodyPart.STEM, feature=StemFeature.BULB, phase=Phase.OLD
    )
    await cf.add_trait(session, porcini, "cap", "Der Hut ist braun.")
    await cf.add_source(
        session,
        porcini,
        position=0,
        scope=SourceScope.PROFILE,
        title="123pilzsuche",
        url="https://example.test",
        checked_on=date(2025, 1, 1),
    )
    await cf.add_season(session, porcini, Season.SUMMER)
    smell = await cf.make_term(session, kind=TermKind.SMELL, slug="fruity", name="fruchtig")
    await cf.add_term(session, porcini, smell, from_experience=True)
    await cf.add_lookalike(session, porcini, bay, difference_a="heller", difference_b="dunkler")

    response = await api.get(f"/species/{porcini.slug}")
    assert response.status_code == 200
    body = response.json()
    assert body["names"] == [{"name": "Herrenpilz", "kind": "synonym"}]
    assert body["measurements"][0]["part"] == "cap"
    assert body["colours"][0]["colours"][0]["nearest"] == "#6b4423"
    assert body["colourChanges"][0]["triggers"][0]["slug"] == "cut"
    assert {"feature": "umbonate", "phase": "young"} in body["capFeatures"]
    assert {"margin": "inrolled", "phase": "young"} in body["capMargins"]
    assert body["stemFeatures"] == [{"feature": "bulb", "phase": "old"}]
    assert body["traits"] == [{"key": "cap", "text": "Der Hut ist braun."}]
    assert body["sources"][0]["title"] == "123pilzsuche"
    assert body["seasons"] == ["summer"]
    assert body["terms"][0]["fromExperience"] is True
    assert body["lookalikes"][0]["slug"] == bay.slug
    assert body["lookalikes"][0]["difference"] == "dunkler"

    other = await api.get(f"/species/{bay.slug}")
    other_body = other.json()
    assert other_body["lookalikes"][0]["slug"] == porcini.slug
    assert other_body["lookalikes"][0]["difference"] == "heller"


async def test_get_species_404(api: httpx.AsyncClient) -> None:
    response = await api.get("/species/unknown-species")
    assert response.status_code == 404


def _write_payload(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "name": "Steinpilz",
        "scientificName": "Boletus edulis",
        "group": Group.BOLETE.value,
        "edibility": Edibility.EDIBLE.value,
        "protection": Protection.NONE.value,
    }
    body.update(overrides)
    return body


async def test_create_species_requires_permission(api: httpx.AsyncClient) -> None:
    response = await api.post("/species", json=_write_payload())
    assert response.status_code == 401


async def test_create_species_success_builds_slug_from_latin_name(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.post("/species", json=_write_payload(scientificName="Böletus Édulis"))
    sign_out(app_of(api))
    assert response.status_code == 201
    body = response.json()
    assert body["slug"] == "boeletus-edulis"


async def test_create_species_duplicate_slug_conflicts(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    first = await api.post("/species", json=_write_payload())
    assert first.status_code == 201
    second = await api.post("/species", json=_write_payload(name="Anderer Name"))
    sign_out(app_of(api))
    assert second.status_code == 409
    assert second.json()["code"] == "slug_taken"


async def test_replace_species_replaces_child_rows(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    porcini = await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    await cf.add_name(session, porcini, 0, "Herrenpilz", NameKind.SYNONYM)
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    payload = _write_payload(names=[{"name": "Neuer Name", "kind": "common"}])
    response = await api.put(f"/species/{porcini.slug}", json=payload)
    sign_out(app_of(api))
    assert response.status_code == 200
    body = response.json()
    assert body["names"] == [{"name": "Neuer Name", "kind": "common"}]
    assert body["slug"] == porcini.slug


async def test_replace_species_writes_every_child_kind(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    porcini = await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    other = await cf.make_species(
        session, slug="boletus-aereus", name="Sommersteinpilz", latin_name="Boletus aereus"
    )
    term = await cf.make_term(session, kind=TermKind.SMELL, slug="fruity", name="fruchtig")
    term_ref = {"id": str(term.id), "slug": term.slug, "name": term.name, "kind": term.kind}
    colour_changes: list[dict[str, Any]] = [
        {
            "part": "flesh",
            "kind": "mechanical",
            "from": {"name": "weiss", "hex": "#ffffff"},
            "to": {"name": "blau", "hex": "#3a6ea8"},
            "triggers": [term_ref],
        },
        {
            "part": "cap",
            "kind": "environment",
            "to": {"name": "dunkel", "hex": "#2a2a2a"},
            "triggers": [],
        },
    ]
    payload = _write_payload(
        measurements=[
            {
                "part": "cap",
                "measurements": [{"dimension": "width", "unit": "cm", "low": 4.0, "high": 20.0}],
            },
        ],
        colours=[
            {
                "part": "cap",
                "mode": "distinct",
                "colours": [
                    {"name": "braun", "hex": "#7a5230"},
                    {"name": "creme", "hex": "#f2e6c2"},
                ],
            },
        ],
        colourChanges=colour_changes,
        capFeatures=[{"feature": "umbonate", "phase": "young"}],
        capMargins=[{"margin": "inrolled", "phase": "young"}],
        stemFeatures=[{"feature": "bulb", "phase": "old"}],
        traits=[{"key": "cap", "text": "Der Hut ist braun."}],
        sources=[
            {
                "scope": "profile",
                "title": "Quelle",
                "url": "https://example.test",
                "checkedOn": "2025-01-01",
            }
        ],
        seasons=["summer"],
        terms=[{"term": term_ref, "fromExperience": True}],
        lookalikes=[{"slug": other.slug, "difference": "neu"}],
    )
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.put(f"/species/{porcini.slug}", json=payload)
    sign_out(app_of(api))
    assert response.status_code == 200
    body = response.json()
    assert body["measurements"][0]["measurements"][0]["low"] == 4.0
    assert len(body["colours"][0]["colours"]) == 2
    assert body["colourChanges"][0]["from"]["hex"] == "#ffffff"
    assert body["colourChanges"][1]["from"] is None
    assert body["capFeatures"] == [{"feature": "umbonate", "phase": "young"}]
    assert body["capMargins"] == [{"margin": "inrolled", "phase": "young"}]
    assert body["stemFeatures"] == [{"feature": "bulb", "phase": "old"}]
    assert body["traits"] == [{"key": "cap", "text": "Der Hut ist braun."}]
    assert body["sources"][0]["title"] == "Quelle"
    assert body["seasons"] == ["summer"]
    assert body["terms"][0]["fromExperience"] is True
    assert body["lookalikes"] == [
        {
            "slug": other.slug,
            "name": other.name,
            "scientificName": other.latin_name,
            "edibility": other.edibility.value,
            "capColours": [],
            "difference": "neu",
        },
    ]


async def test_replace_species_lookalike_sync_is_independent_per_side(
    session: AsyncSession,
    api: httpx.AsyncClient,
) -> None:
    porcini = await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    bay = await cf.make_species(
        session, slug="boletus-badius", name="Maronenröhrling", latin_name="Boletus badius"
    )
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")

    porcini_payload = _write_payload(lookalikes=[{"slug": bay.slug, "difference": "von porcini"}])
    await api.put(f"/species/{porcini.slug}", json=porcini_payload)
    bay_payload = _write_payload(name=bay.name, scientificName=bay.latin_name, lookalikes=[])
    await api.put(f"/species/{bay.slug}", json=bay_payload)

    porcini_body = (await api.get(f"/species/{porcini.slug}")).json()
    assert porcini_body["lookalikes"] == [
        {
            "slug": bay.slug,
            "name": bay.name,
            "scientificName": bay.latin_name,
            "edibility": bay.edibility.value,
            "capColours": [],
            "difference": "von porcini",
        },
    ]
    bay_body = (await api.get(f"/species/{bay.slug}")).json()
    assert bay_body["lookalikes"][0]["slug"] == porcini.slug
    assert bay_body["lookalikes"][0]["difference"] is None

    empty_payload = _write_payload(lookalikes=[])
    await api.put(f"/species/{porcini.slug}", json=empty_payload)
    sign_out(app_of(api))

    porcini_after = (await api.get(f"/species/{porcini.slug}")).json()
    assert porcini_after["lookalikes"] == []
    bay_after = (await api.get(f"/species/{bay.slug}")).json()
    assert bay_after["lookalikes"] == []


async def test_replace_species_404(session: AsyncSession, api: httpx.AsyncClient) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.put("/species/unknown-species", json=_write_payload())
    sign_out(app_of(api))
    assert response.status_code == 404


async def test_replace_species_unknown_lookalike_slug_is_invalid(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    porcini = await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    payload = _write_payload(lookalikes=[{"slug": "unknown-species", "difference": "x"}])
    response = await api.put(f"/species/{porcini.slug}", json=payload)
    sign_out(app_of(api))
    assert response.status_code == 422


async def test_delete_species_success(session: AsyncSession, api: httpx.AsyncClient) -> None:
    porcini = await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.delete(f"/species/{porcini.slug}")
    sign_out(app_of(api))
    assert response.status_code == 204


async def test_delete_species_in_use_by_find_conflicts(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    porcini = await make_find_species(session, slug="boletus-edulis")
    owner = await make_user(session, sub="owner-1")
    from app.models import Find  # noqa: PLC0415

    session.add(
        Find(owner_id=owner.id, species_id=porcini.id, lat=0.0, lon=0.0, found_on=date(2025, 1, 1))
    )
    await session.commit()

    user = await make_user(session, sub="editor-1")
    sign_in(app_of(api), user, "species.edit")
    response = await api.delete(f"/species/{porcini.slug}")
    sign_out(app_of(api))
    assert response.status_code == 409
    assert response.json()["code"] == "in_use"


async def test_delete_species_in_use_by_photo_conflicts(
    session: AsyncSession, api: httpx.AsyncClient
) -> None:
    porcini = await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    await cf.add_lead_photo(session, porcini)
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.delete(f"/species/{porcini.slug}")
    sign_out(app_of(api))
    assert response.status_code == 409
    assert response.json()["code"] == "in_use"


async def test_set_forecast(session: AsyncSession, api: httpx.AsyncClient) -> None:
    porcini = await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    user = await make_user(session)
    sign_in(app_of(api), user, "species.edit")
    response = await api.put(f"/species/{porcini.slug}/forecast", json={"enabled": True})
    sign_out(app_of(api))
    assert response.status_code == 200
    assert response.json()["forecastEnabled"] is True


async def test_counts(session: AsyncSession, api: httpx.AsyncClient) -> None:
    porcini = await make_find_species(session, slug="boletus-edulis")
    await cf.add_lead_photo(session, porcini)
    owner = await make_user(session, sub="owner-2")
    from app.models import Find  # noqa: PLC0415

    session.add(
        Find(owner_id=owner.id, species_id=porcini.id, lat=0.0, lon=0.0, found_on=date(2025, 1, 1))
    )
    await session.commit()

    user = await make_user(session, sub="editor-2")
    sign_in(app_of(api), user, "species.edit")
    response = await api.get(f"/species/{porcini.slug}/counts")
    sign_out(app_of(api))
    assert response.status_code == 200
    body = response.json()
    assert body["finds"] == 1
    assert body["photos"] == 1
    assert body["records"] == 0


async def test_counts_all_reads_records_finds_and_photos(session: AsyncSession) -> None:
    from app.models import Find, PipelineRun, PipelineRunSpecies  # noqa: PLC0415
    from app.modules.catalog.service import SpeciesService  # noqa: PLC0415
    from app.shared.enums import RunKind, RunState  # noqa: PLC0415
    from app.shared.paging import Paging  # noqa: PLC0415

    porcini = await make_find_species(session, slug="boletus-edulis")
    await cf.add_lead_photo(session, porcini)
    owner = await make_user(session, sub="owner-3")
    run = PipelineRun(kind=RunKind.TRAINING)
    session.add(run)
    await session.flush()
    session.add_all(
        [
            Find(
                owner_id=owner.id,
                species_id=porcini.id,
                lat=0.0,
                lon=0.0,
                found_on=date(2025, 1, 1),
            ),
            PipelineRunSpecies(
                run_id=run.id,
                species_id=porcini.id,
                state=RunState.FINISHED,
                record_count=42,
            ),
        ]
    )
    await session.commit()

    found = await SpeciesService(session).counts_all(Paging(limit=40, offset=0))
    assert found[porcini.id].records == 42
    assert found[porcini.id].finds == 1
    assert found[porcini.id].photos == 1


async def test_counts_keep_the_last_finished_run(
    session: AsyncSession,
    api: httpx.AsyncClient,
) -> None:
    from app.models import PipelineRun, PipelineRunSpecies  # noqa: PLC0415
    from app.shared.enums import RunKind, RunState  # noqa: PLC0415

    porcini = await make_find_species(session, slug="boletus-edulis")
    done = PipelineRun(kind=RunKind.TRAINING)
    waiting = PipelineRun(kind=RunKind.TRAINING)
    session.add_all([done, waiting])
    await session.flush()
    session.add_all(
        [
            PipelineRunSpecies(
                run_id=done.id,
                species_id=porcini.id,
                state=RunState.FINISHED,
                record_count=42,
            ),
            PipelineRunSpecies(run_id=waiting.id, species_id=porcini.id, state=RunState.QUEUED),
        ]
    )
    await session.commit()

    user = await make_user(session, sub="editor-3")
    sign_in(app_of(api), user, "species.edit")
    response = await api.get(f"/species/{porcini.slug}/counts")
    sign_out(app_of(api))
    assert response.json()["records"] == 42


async def test_counts_requires_permission(session: AsyncSession, api: httpx.AsyncClient) -> None:
    porcini = await cf.make_species(
        session, slug="boletus-edulis", name="Steinpilz", latin_name="Boletus edulis"
    )
    response = await api.get(f"/species/{porcini.slug}/counts")
    assert response.status_code == 401


async def test_profile_names_the_account_that_changed_it(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session, "person-editor")
    user.name = "Frederik"
    species = await cf.make_species(session, slug="boletus-edulis", name="Steinpilz")
    species.updated_by_id = user.id
    await session.commit()

    answer = await api.get("/species/boletus-edulis")
    assert answer.status_code == 200
    assert answer.json()["updatedByName"] == "Frederik"

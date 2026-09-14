"""Der Katalog aus dem Import über die Schnittstelle."""

import tomllib

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SpeciesMeasurement
from tools import import_catalog
from tools.catalog_rows import Report


def profile_count() -> int:
    """Die Zahl der TOML-Profile unter ``daten/arten``."""
    return len(list(import_catalog.SPECIES_DIR.glob("*.toml")))


async def pages(api: httpx.AsyncClient, path: str) -> list[dict[str, object]]:
    """Blättert einen Pfad vollständig durch."""
    found: list[dict[str, object]] = []
    cursor: str | None = None
    while True:
        params: dict[str, str] = {"limit": "40"}
        if cursor:
            params["cursor"] = cursor
        answer = await api.get(path, params=params)
        assert answer.status_code == 200
        body = answer.json()
        found.extend(body["items"])
        cursor = body["nextCursor"]
        if cursor is None:
            return found


async def test_species_list_serves_every_profile(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    await import_catalog.import_all(session, Report())
    items = await pages(api, "/species")
    assert len(items) == profile_count()
    assert all(item["slug"] for item in items)


async def test_a_known_species_comes_from_the_table(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    await import_catalog.import_all(session, Report())
    answer = await api.get("/species/boletus-edulis")
    assert answer.status_code == 200
    body = answer.json()
    assert body["scientificName"] == "Boletus edulis"
    assert body["edibility"] == "edible"
    assert body["group"] == "bolete"
    assert body["protection"] == "personal_use"
    assert any(group["part"] == "cap" for group in body["colours"])
    assert body["lookalikes"]


async def test_the_bundle_carries_every_species(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    await import_catalog.import_all(session, Report())
    answer = await api.get("/species/bundle")
    assert answer.status_code == 200
    body = answer.json()
    assert len(body["items"]) == profile_count()
    assert len(body["standardColours"]) == 12


def toml_measurements() -> int:
    """Zählt die Maße in allen Profilen."""
    total = 0
    for file in import_catalog.SPECIES_DIR.glob("*.toml"):
        with file.open("rb") as handle:
            total += len(tomllib.load(handle).get("masse", {}))
    return total


async def test_every_measurement_of_the_profiles_is_in_the_table(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    report = Report()
    await import_catalog.import_all(session, report)
    assert "measurement_ohne_koerperteil" not in report.skipped
    rows = await session.execute(select(func.count()).select_from(SpeciesMeasurement))
    assert rows.scalar_one() == toml_measurements()
    answer = await api.get("/species/boletus-edulis")
    groups = {group["part"] for group in answer.json()["measurements"]}
    assert "spore" in groups

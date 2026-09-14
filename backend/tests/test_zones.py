import json
import uuid

import httpx
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.modules.objects import tiles
from tests.conftest import app_of, make_user, sign_in
from tests.objects_support import make_species

SQUARE = {
    "type": "Polygon",
    "coordinates": [
        [
            [8.60, 50.10],
            [8.62, 50.10],
            [8.62, 50.12],
            [8.60, 50.12],
            [8.60, 50.10],
        ],
    ],
}


def write_map(slug: str, ring: list[tuple[float, float]], value: int) -> None:
    """Legt Manifest und Wertkachel einer Art unter ``PILZE_MAPS`` ab."""
    maps = get_settings().maps
    maps.mkdir(parents=True, exist_ok=True)
    zoom = 8
    cell = tiles.cells_under(ring, zoom)[0]
    path = f"{slug}/2026-37"
    body = {
        "name": slug,
        "top": 0.5,
        "weeks": [{"year": 2026, "week": 37, "tiles": path}],
        "tiles": {"have": {str(zoom): [f"{cell.tile_x}/{cell.tile_y}"]}},
    }
    (maps / f"{slug}.json").write_text(json.dumps(body), encoding="utf-8")
    folder = maps / path / str(zoom) / str(cell.tile_x)
    folder.mkdir(parents=True, exist_ok=True)
    Image.new("L", (tiles.TILE, tiles.TILE), value).save(folder / f"{cell.tile_y}.png")


RING = [(8.60, 50.10), (8.62, 50.10), (8.62, 50.12), (8.60, 50.12), (8.60, 50.10)]


async def test_create_computes_area(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/zones", json={"name": "Wald", "polygon": SQUARE})
    assert created.status_code == 201
    assert created.json()["areaHa"] > 0


async def test_get_a_zone(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/zones", json={"name": "Wald", "polygon": SQUARE})
    fetched = await api.get(f"/zones/{created.json()['id']}")
    assert fetched.status_code == 200


async def test_list_and_changes_since(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/zones", json={"name": "Wald", "polygon": SQUARE})
    listed = await api.get("/zones")
    assert len(listed.json()["items"]) == 1
    since_list = await api.get("/zones", params={"since": "1970-01-01T00:00:00Z"})
    ids = {item["id"] for item in since_list.json()["items"]}
    assert created.json()["id"] in ids


async def test_put_replaces_a_zone(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    zone_id = str(uuid.uuid4())
    first = await api.put(f"/zones/{zone_id}", json={"name": "Alt", "polygon": SQUARE})
    assert first.status_code == 201
    second = await api.put(f"/zones/{zone_id}", json={"name": "Neu", "polygon": SQUARE})
    assert second.status_code == 200
    assert second.json()["name"] == "Neu"


async def test_put_of_foreign_zone_is_not_found(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    zone_id = str(uuid.uuid4())
    await api.put(f"/zones/{zone_id}", json={"name": "Anna", "polygon": SQUARE})
    sign_in(app_of(api), bert)
    answer = await api.put(f"/zones/{zone_id}", json={"name": "Bert", "polygon": SQUARE})
    assert answer.status_code == 404


async def test_delete_a_zone(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/zones", json={"name": "Wald", "polygon": SQUARE})
    zone_id = created.json()["id"]
    deleted = await api.delete(f"/zones/{zone_id}")
    assert deleted.status_code == 204
    assert (await api.get(f"/zones/{zone_id}")).status_code == 404


async def test_zone_value_without_manifest_is_zero(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/zones", json={"name": "Wald", "polygon": SQUARE})
    zone_id = created.json()["id"]
    species_id = str(uuid.uuid4())
    answer = await api.get(
        f"/zones/{zone_id}/value",
        params={"speciesId": species_id, "year": 2026, "week": 37},
    )
    assert answer.status_code == 200
    body = answer.json()
    assert body["areaMean"] == 0.0
    assert body["points"] == 0
    assert body["ownFinds"] == 0


async def test_zone_value_reads_the_manifest(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/zones", json={"name": "Wald", "polygon": SQUARE})
    zone_id = created.json()["id"]
    species = await make_species(session)
    write_map(species.slug, RING, 255)
    answer = await api.get(
        f"/zones/{zone_id}/value",
        params={"speciesId": str(species.id), "year": 2026, "week": 37},
    )
    body = answer.json()
    assert body["points"] > 0
    assert abs(body["areaMean"] - 50.0) < 0.5


async def test_zone_value_without_the_week_is_zero(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/zones", json={"name": "Wald", "polygon": SQUARE})
    zone_id = created.json()["id"]
    species = await make_species(session)
    write_map(species.slug, RING, 255)
    answer = await api.get(
        f"/zones/{zone_id}/value",
        params={"speciesId": str(species.id), "year": 2026, "week": 1},
    )
    assert answer.json()["points"] == 0


async def test_zone_value_counts_own_finds(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "anna")
    sign_in(app_of(api), user)
    created = await api.post("/zones", json={"name": "Wald", "polygon": SQUARE})
    zone_id = created.json()["id"]
    species = await make_species(session)
    species_id = str(species.id)
    await api.post(
        "/finds",
        json={"speciesId": species_id, "lat": 50.11, "lon": 8.61, "foundOn": "2026-09-01"},
    )
    await api.post(
        "/finds",
        json={"speciesId": species_id, "lat": 51.0, "lon": 9.0, "foundOn": "2026-09-01"},
    )
    answer = await api.get(
        f"/zones/{zone_id}/value",
        params={"speciesId": species_id, "year": 2026, "week": 37},
    )
    assert answer.json()["ownFinds"] == 1


async def test_zone_value_of_foreign_zone_is_not_found(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    anna = await make_user(session, "anna")
    bert = await make_user(session, "bert")
    sign_in(app_of(api), anna)
    created = await api.post("/zones", json={"name": "Wald", "polygon": SQUARE})
    zone_id = created.json()["id"]
    sign_in(app_of(api), bert)
    answer = await api.get(
        f"/zones/{zone_id}/value",
        params={"speciesId": str(uuid.uuid4()), "year": 2026, "week": 37},
    )
    assert answer.status_code == 404

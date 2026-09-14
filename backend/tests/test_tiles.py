"""Das Manifest der Kette und der Zonenwert daraus."""

import json
import math
from pathlib import Path

from PIL import Image

from app.modules.objects import sources, tiles

RING = [(10.0, 50.0), (10.02, 50.0), (10.02, 50.02), (10.0, 50.02), (10.0, 50.0)]


def write_manifest(maps: Path, name: str, have: dict[int, list[str]]) -> None:
    """Schreibt ein Manifest im Format der Kette."""
    maps.mkdir(parents=True, exist_ok=True)
    body = {
        "name": name,
        "top": 0.5,
        "weeks": [{"year": 2026, "week": 37, "tiles": f"{name}/2026-37"}],
        "tiles": {"have": {str(zoom): names for zoom, names in have.items()}},
    }
    (maps / f"{name}.json").write_text(json.dumps(body), encoding="utf-8")


def write_tile(maps: Path, path: str, zoom: int, tile_x: int, tile_y: int, value: int) -> None:
    """Legt eine Wertkachel mit einem Byte je Punkt ab."""
    folder = maps / path / str(zoom) / str(tile_x)
    folder.mkdir(parents=True, exist_ok=True)
    Image.new("L", (tiles.TILE, tiles.TILE), value).save(folder / f"{tile_y}.png")


def test_read_manifest_without_a_file_is_none(tmp_path: Path) -> None:
    assert tiles.read_manifest(tmp_path, "boletus-edulis") is None


def test_read_manifest_with_broken_json_is_none(tmp_path: Path) -> None:
    (tmp_path / "boletus-edulis.json").write_text("{kaputt", encoding="utf-8")
    assert tiles.read_manifest(tmp_path, "boletus-edulis") is None


def test_find_week(tmp_path: Path) -> None:
    write_manifest(tmp_path, "boletus-edulis", {8: []})
    manifest = tiles.read_manifest(tmp_path, "boletus-edulis")
    assert manifest is not None
    assert tiles.find_week(manifest, 2026, 37) is not None
    assert tiles.find_week(manifest, 2026, 1) is None


def test_world_point_round_trip() -> None:
    x, y = tiles.to_world_point((10.0, 50.0), 8)
    lon, lat = tiles.to_degrees(x, y, 8)
    assert math.isclose(lon, 10.0, abs_tol=1e-6)
    assert math.isclose(lat, 50.0, abs_tol=1e-6)


def test_cells_under_a_small_ring_falls_back_to_the_centre() -> None:
    tiny = [(10.0, 50.0), (10.0001, 50.0), (10.0001, 50.0001), (10.0, 50.0001), (10.0, 50.0)]
    assert len(tiles.cells_under(tiny, 8)) == 1


def test_area_mean_without_tiles_is_zero(tmp_path: Path) -> None:
    write_manifest(tmp_path, "boletus-edulis", {})
    manifest = tiles.read_manifest(tmp_path, "boletus-edulis")
    assert manifest is not None
    assert tiles.area_mean(tmp_path, manifest, "x", RING) == (0.0, 0)


def test_area_mean_skips_a_missing_tile(tmp_path: Path) -> None:
    write_manifest(tmp_path, "boletus-edulis", {8: ["0/0"]})
    manifest = tiles.read_manifest(tmp_path, "boletus-edulis")
    assert manifest is not None
    assert tiles.area_mean(tmp_path, manifest, "boletus-edulis/2026-37", RING) == (0.0, 0)


def test_area_mean_reads_the_tile(tmp_path: Path) -> None:
    zoom = 8
    cells = tiles.cells_under(RING, zoom)
    name = f"{cells[0].tile_x}/{cells[0].tile_y}"
    write_manifest(tmp_path, "boletus-edulis", {zoom: [name]})
    write_tile(tmp_path, "boletus-edulis/2026-37", zoom, cells[0].tile_x, cells[0].tile_y, 255)
    manifest = tiles.read_manifest(tmp_path, "boletus-edulis")
    assert manifest is not None
    mean, points = tiles.area_mean(tmp_path, manifest, "boletus-edulis/2026-37", RING)
    assert points == len(cells)
    assert math.isclose(mean, 50.0, rel_tol=0.01)


def test_a_byte_of_zero_counts_as_no_data(tmp_path: Path) -> None:
    zoom = 8
    cells = tiles.cells_under(RING, zoom)
    name = f"{cells[0].tile_x}/{cells[0].tile_y}"
    write_manifest(tmp_path, "boletus-edulis", {zoom: [name]})
    write_tile(tmp_path, "boletus-edulis/2026-37", zoom, cells[0].tile_x, cells[0].tile_y, 0)
    manifest = tiles.read_manifest(tmp_path, "boletus-edulis")
    assert manifest is not None
    assert tiles.area_mean(tmp_path, manifest, "boletus-edulis/2026-37", RING) == (0.0, 0)


def test_layer_names_without_a_file(tmp_path: Path) -> None:
    assert sources.layer_names(tmp_path) == frozenset()
    assert sources.map_names(tmp_path / "fehlt") == frozenset()


def test_layer_names_reads_the_index(tmp_path: Path) -> None:
    body = {"layers": {"rain": {"label": "Regen", "unit": "mm"}}}
    (tmp_path / "layers.json").write_text(json.dumps(body), encoding="utf-8")
    assert sources.layer_names(tmp_path) == frozenset({"rain"})


def test_broken_layer_index_is_empty(tmp_path: Path) -> None:
    (tmp_path / "layers.json").write_text("[]", encoding="utf-8")
    assert sources.layer_names(tmp_path) == frozenset()


def test_map_names_come_from_the_manifests(tmp_path: Path) -> None:
    write_manifest(tmp_path, "boletus-edulis", {8: []})
    (tmp_path / "layers.json").write_text('{"layers": {}}', encoding="utf-8")
    assert sources.map_names(tmp_path) == frozenset({"boletus-edulis"})


class Factor:
    """Ein Faktor mit einer Quelle."""

    def __init__(self, source: str) -> None:
        self.source = source


def test_check_sources(tmp_path: Path) -> None:
    assert sources.check_sources(tmp_path, [Factor("rain")]) == []
    write_manifest(tmp_path, "boletus-edulis", {8: []})
    assert sources.check_sources(tmp_path, [Factor("boletus-edulis")]) == []
    assert sources.check_sources(tmp_path, [Factor("gibt-es-nicht")]) == [
        {"field": "factors.0.source", "code": "unknown_source"},
    ]

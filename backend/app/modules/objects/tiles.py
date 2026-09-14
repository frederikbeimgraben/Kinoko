"""Der Zonenwert: die Wertkacheln der Kette unter einer Fläche mitteln."""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from PIL import Image
from pydantic import BaseModel, ConfigDict

from app.shared.geometry import bounds, centroid, point_in_polygon

if TYPE_CHECKING:
    from pathlib import Path

    from app.shared.geometry import Point, Ring

TILE: Final = 256
STEPS: Final = 254
PERCENT: Final = 100


class TileIndex(BaseModel):
    """Welche Kacheln die Kette gerendert hat, je Zoomstufe."""

    model_config = ConfigDict(extra="ignore")

    have: dict[int, list[str]]


class WeekTiles(BaseModel):
    """Eine Woche im Manifest, mit dem Pfad zu ihren Kacheln."""

    model_config = ConfigDict(extra="ignore")

    year: int
    week: int
    tiles: str


class Manifest(BaseModel):
    """Das Manifest einer Art unter ``PILZE_MAPS``."""

    model_config = ConfigDict(extra="ignore")

    name: str
    top: float
    weeks: list[WeekTiles]
    tiles: TileIndex


@dataclass(frozen=True, slots=True)
class Cell:
    """Ein Punkt einer Kachel: welche Kachel, und wo darin."""

    tile_x: int
    tile_y: int
    x: int
    y: int


def read_manifest(maps: Path, map_name: str) -> Manifest | None:
    """Liest das Manifest einer Art. Ohne Datei kommt nichts zurück."""
    file = maps / f"{map_name}.json"
    if not file.is_file():
        return None
    try:
        return Manifest.model_validate_json(file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def find_week(manifest: Manifest, year: int, week: int) -> WeekTiles | None:
    """Sucht die Woche im Manifest."""
    for entry in manifest.weeks:
        if entry.year == year and entry.week == week:
            return entry
    return None


def to_world_point(point: Point, zoom: int) -> tuple[float, float]:
    """Rechnet Grad in Kachelpunkte der Weltkarte um (Web Mercator)."""
    lon, lat = point
    radian = math.radians(lat)
    edge = TILE * 2**zoom
    x = (lon + 180.0) / 360.0 * edge
    y = (1 - math.log(math.tan(radian) + 1 / math.cos(radian)) / math.pi) / 2 * edge
    return x, y


def to_degrees(x: float, y: float, zoom: int) -> Point:
    """Rechnet Kachelpunkte der Weltkarte zurück in Grad."""
    edge = TILE * 2**zoom
    lon = x / edge * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / edge))))
    return lon, lat


def _cell(world_x: int, world_y: int) -> Cell:
    return Cell(
        tile_x=world_x // TILE,
        tile_y=world_y // TILE,
        x=world_x % TILE,
        y=world_y % TILE,
    )


def cells_under(ring: Ring, zoom: int) -> list[Cell]:
    """Die Kachelpunkte, deren Mitte in der Fläche liegt."""
    west, south, east, north = bounds(ring)
    left, top = to_world_point((west, north), zoom)
    right, bottom = to_world_point((east, south), zoom)
    # Eine Zone schmaler als ein Kachelpunkt bekommt den Punkt unter ihrem Schwerpunkt.
    found = [
        _cell(world_x, world_y)
        for world_y in range(int(top), int(bottom) + 1)
        for world_x in range(int(left), int(right) + 1)
        if point_in_polygon(to_degrees(world_x + 0.5, world_y + 0.5, zoom), ring)
    ]
    if not found:
        centre_x, centre_y = to_world_point(centroid(ring), zoom)
        found.append(_cell(int(centre_x), int(centre_y)))
    return found


def _by_tile(cells: list[Cell]) -> dict[tuple[int, int], list[Cell]]:
    groups: dict[tuple[int, int], list[Cell]] = defaultdict(list)
    for cell in cells:
        groups[(cell.tile_x, cell.tile_y)].append(cell)
    return groups


def _tile_sum(file: Path, group: list[Cell]) -> tuple[float, int]:
    """Mittelt die Punkte einer Kachel. Byte null trägt nichts bei."""
    total = 0.0
    points = 0
    with Image.open(file) as image:
        grey = image.convert("L")
    for cell in group:
        tier = int(grey.getpixel((cell.x, cell.y)))  # pyright: ignore[reportArgumentType]
        if tier > 0:
            total += (tier - 1) / STEPS
            points += 1
    return total, points


def area_mean(maps: Path, manifest: Manifest, tile_path: str, ring: Ring) -> tuple[float, int]:
    """Mittelt die Wertkacheln unter einer Fläche, in Prozent."""
    if not manifest.tiles.have:
        return 0.0, 0
    zoom = max(manifest.tiles.have)
    present = set(manifest.tiles.have[zoom])
    total = 0.0
    points = 0
    for (tile_x, tile_y), group in _by_tile(cells_under(ring, zoom)).items():
        file = maps / tile_path / str(zoom) / str(tile_x) / f"{tile_y}.png"
        if f"{tile_x}/{tile_y}" not in present or not file.is_file():
            continue
        part, found = _tile_sum(file, group)
        total += part
        points += found
    if points == 0:
        return 0.0, 0
    return total / points * manifest.top * PERCENT, points

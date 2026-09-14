"""Punkte, Flächen und das Runden geschützter Orte."""

from __future__ import annotations

import math
from itertools import pairwise
from typing import Final

LAT_MIN: Final = -90.0
LAT_MAX: Final = 90.0
LON_MIN: Final = -180.0
LON_MAX: Final = 180.0
EARTH_RADIUS_M: Final = 6_371_000.0
RING_MIN_POINTS: Final = 4

type Point = tuple[float, float]
type Ring = list[Point]


def area_ha(ring: Ring) -> float:
    """Die Fläche eines Rings in Hektar, über eine ebene Näherung."""
    if len(ring) < RING_MIN_POINTS:
        return 0.0
    mean_lat = math.radians(sum(point[1] for point in ring) / len(ring))
    metre_lon = math.radians(1.0) * EARTH_RADIUS_M * math.cos(mean_lat)
    metre_lat = math.radians(1.0) * EARTH_RADIUS_M
    total = 0.0
    for first, second in pairwise(ring):
        total += (first[0] * metre_lon) * (second[1] * metre_lat)
        total -= (second[0] * metre_lon) * (first[1] * metre_lat)
    return abs(total) / 2.0 / 10_000.0


def point_in_polygon(point: Point, ring: Ring) -> bool:
    """Sagt, ob ein Punkt in einem Ring liegt."""
    lon, lat = point
    inside = False
    for first, second in pairwise(ring):
        crosses = (first[1] > lat) != (second[1] > lat)
        if not crosses:
            continue
        span = second[1] - first[1]
        if span == 0:
            continue
        cut = first[0] + (lat - first[1]) / span * (second[0] - first[0])
        if lon < cut:
            inside = not inside
    return inside


def coarse(point: Point, km: float = 1.0) -> Point:
    """Rundet einen Punkt auf ein Raster von ``km`` Kilometern."""
    step_lat = km / 111.32
    lat = round(point[1] / step_lat) * step_lat
    step_lon = step_lat / max(math.cos(math.radians(lat)), 0.01)
    return (round(point[0] / step_lon) * step_lon, lat)


def bounds(ring: Ring) -> tuple[float, float, float, float]:
    """Das umschließende Rechteck eines Rings."""
    lons = [point[0] for point in ring]
    lats = [point[1] for point in ring]
    return (min(lons), min(lats), max(lons), max(lats))


def parse_bbox(raw: str) -> tuple[float, float, float, float] | None:
    """Liest ``minLon,minLat,maxLon,maxLat``, sonst nichts."""
    parts = raw.split(",")
    if len(parts) != RING_MIN_POINTS:
        return None
    try:
        west, south, east, north = (float(part) for part in parts)
    except ValueError:
        return None
    if west > east or south > north:
        return None
    return (west, south, east, north)

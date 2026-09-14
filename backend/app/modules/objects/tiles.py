"""Das Kachel-Manifest unter ``settings.maps``, defensiv gelesen."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from app.core.settings import get_settings
from app.shared.geometry import point_in_polygon

if TYPE_CHECKING:
    from collections.abc import Sequence
    from uuid import UUID

    from app.shared.geometry import Ring

MANIFEST_NAME = "layers.json"


def manifest_path() -> Any:  # noqa: ANN401
    """Der Pfad zum Manifest."""
    return get_settings().maps / MANIFEST_NAME


def read_manifest() -> list[dict[str, Any]] | None:
    """Liest die Ebenen des Manifests. ``None`` ohne Manifest."""
    path = manifest_path()
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    layers = raw.get("layers") if isinstance(raw, dict) else None
    return layers if isinstance(layers, list) else []


def source_names(layers: list[dict[str, Any]]) -> set[str]:
    """Die Namen der Ebenen eines Manifests."""
    return {layer["name"] for layer in layers if isinstance(layer, dict) and "name" in layer}


def check_sources(factors: Sequence[Any], layers: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    """Prüft jede Quelle eines Faktors gegen das Manifest."""
    if layers is None:
        return []
    names = source_names(layers)
    return [
        {"field": f"factors.{index}.source", "code": "unknown_source"}
        for index, factor in enumerate(factors)
        if factor.source not in names
    ]


def _points(layer: dict[str, Any], species_id: UUID, year: int, week: int) -> list[float]:
    if (
        layer.get("speciesId") != str(species_id)
        or layer.get("year") != year
        or layer.get("week") != week
    ):
        return []
    raw_points = layer.get("points")
    if not isinstance(raw_points, list):
        return []
    return [float(point["value"]) for point in raw_points if isinstance(point, dict)]


def area_mean(
    layers: list[dict[str, Any]] | None,
    ring: Ring,
    species_id: UUID,
    year: int,
    week: int,
) -> tuple[float, int]:
    """Der Mittelwert und die Zahl der Rasterpunkte einer Zone."""
    if not layers:
        return 0.0, 0
    values: list[float] = []
    for layer in layers:
        if not isinstance(layer, dict):
            continue
        if layer.get("speciesId") != str(species_id) or layer.get("year") != year:
            continue
        if layer.get("week") != week:
            continue
        for point in layer.get("points", []):
            if not isinstance(point, dict):
                continue
            lat, lon, value = point.get("lat"), point.get("lon"), point.get("value")
            if not all(isinstance(part, (int, float)) for part in (lat, lon, value)):
                continue
            if point_in_polygon((float(lon), float(lat)), ring):
                values.append(float(value))
    if not values:
        return 0.0, 0
    return sum(values) / len(values), len(values)

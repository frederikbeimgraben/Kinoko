"""Was als Quelle eines Faktors taugt: Ebenen und Vorhersagekarten."""

from __future__ import annotations

from typing import TYPE_CHECKING, Final

from pydantic import BaseModel, ConfigDict

if TYPE_CHECKING:
    from collections.abc import Sequence
    from pathlib import Path

FILE: Final = "layers.json"


class LayerEntry(BaseModel):
    """Eine Ebene in ``layers.json``."""

    model_config = ConfigDict(extra="ignore")

    label: str = ""
    unit: str = ""


class LayerIndex(BaseModel):
    """Das Dokument ``layers.json`` neben den Kacheln."""

    model_config = ConfigDict(extra="ignore")

    layers: dict[str, LayerEntry] = {}


def layer_names(maps: Path) -> frozenset[str]:
    """Die Namen der Eingabe-Ebenen unter ``PILZE_MAPS``."""
    file = maps / FILE
    if not file.is_file():
        return frozenset()
    try:
        return frozenset(LayerIndex.model_validate_json(file.read_text(encoding="utf-8")).layers)
    except ValueError:
        return frozenset()


def map_names(maps: Path) -> frozenset[str]:
    """Die Namen der Vorhersagekarten unter ``PILZE_MAPS``."""
    if not maps.is_dir():
        return frozenset()
    return frozenset(file.stem for file in maps.glob("*.json") if file.name != FILE)


def check_sources(maps: Path, factors: Sequence[object]) -> list[dict[str, str]]:
    """Prüft jede Quelle eines Faktors gegen die Namen unter ``PILZE_MAPS``."""
    known = layer_names(maps) | map_names(maps)
    if not known:
        return []
    return [
        {"field": f"factors.{index}.source", "code": "unknown_source"}
        for index, factor in enumerate(factors)
        if str(getattr(factor, "source", "")) not in known
    ]

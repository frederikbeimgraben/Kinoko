"""Die Achsen des Filters: belegte Werte und der Abgleich je Art."""

from __future__ import annotations

import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from app.modules.catalog import colours
from app.shared.enums import BodyPart, CapShape, Dimension, Edibility, HymeniumType, Protection

if TYPE_CHECKING:
    from collections.abc import Sequence


#: Der einzige Wert der Achse Vorhersage.
FORECAST_VALUE = "on"


@dataclass(frozen=True, slots=True)
class SpeciesFacets:
    """Die filterbaren Merkmale einer Art."""

    species_id: uuid.UUID
    edibility: Edibility
    hymenium: HymeniumType | None
    cap_shapes: frozenset[CapShape]
    colours: dict[BodyPart, frozenset[str]]
    measurements: dict[tuple[BodyPart, Dimension], tuple[float, float]]
    period: tuple[int, int] | None
    term_ids: frozenset[uuid.UUID]
    protection: Protection = Protection.NONE
    forecast_enabled: bool = False
    genus_name: str = ""
    family_name: str | None = None
    senses: frozenset[str] = frozenset()
    trees: frozenset[str] = frozenset()


@dataclass(frozen=True, slots=True)
class Selection:
    """Eine Filterwahl aus der Artenliste."""

    edibility: frozenset[Edibility] = frozenset()
    hymenium: frozenset[HymeniumType] = frozenset()
    cap_shape: frozenset[CapShape] = frozenset()
    terms: frozenset[uuid.UUID] = frozenset()
    months: frozenset[int] = frozenset()
    colours: dict[BodyPart, str] = field(default_factory=dict)
    sizes: dict[tuple[BodyPart, Dimension], tuple[float | None, float | None]] = field(
        default_factory=dict,
    )

    def active(self) -> bool:
        """Sagt, ob mindestens eine Achse gesetzt ist."""
        return bool(
            self.edibility
            or self.hymenium
            or self.cap_shape
            or self.terms
            or self.months
            or self.colours
            or self.sizes,
        )


def month_in_period(period: tuple[int, int] | None, month: int) -> bool:
    """Sagt, ob ein Monat in einer Spanne liegt, auch über den Jahreswechsel."""
    if period is None:
        return False
    start, end = period
    if start <= end:
        return start <= month <= end
    return month >= start or month <= end


class FacetService:
    """Rechnet Filterachsen und prüft eine Art gegen eine Wahl."""

    def catalogue(self, species: Sequence[SpeciesFacets]) -> dict[str, dict[str, int]]:
        """Zählt je Achse, wie viele Arten einen Wert tragen."""
        axes: dict[str, Counter[str]] = defaultdict(Counter)
        unknown: Counter[str] = Counter()
        for entry in species:
            for axis, values in self._values_of(entry).items():
                if values:
                    axes[axis].update(values)
                elif axis != "forecast":
                    unknown[axis] += 1
            for part, keys in entry.colours.items():
                axes[f"colour.{part}"].update(keys)
        if unknown:
            axes["unknown"] = unknown
        return {axis: dict(counts) for axis, counts in axes.items()}

    def _values_of(self, entry: SpeciesFacets) -> dict[str, list[str]]:
        """Die Werte einer Art je Achse, in der Form des Bündels."""
        months = [
            str(month) for month in range(1, 13) if month_in_period(entry.period, month)
        ]
        return {
            "edibility": [str(entry.edibility)],
            "hymenium": [str(entry.hymenium)] if entry.hymenium is not None else [],
            "capShape": sorted(str(shape) for shape in entry.cap_shapes),
            "protection": [str(entry.protection)],
            "forecast": [FORECAST_VALUE] if entry.forecast_enabled else [],
            "period": months,
            "senses": sorted(entry.senses),
            "treePartner": sorted(entry.trees),
            "genusFamily": [name for name in (entry.genus_name, entry.family_name) if name],
        }

    def match(self, species: SpeciesFacets, selection: Selection) -> bool:
        """Prüft, ob eine Art zu einer Filterwahl passt."""
        checks = (
            not selection.edibility or species.edibility in selection.edibility,
            not selection.hymenium or species.hymenium in selection.hymenium,
            not selection.cap_shape or bool(species.cap_shapes & selection.cap_shape),
            not selection.terms or selection.terms <= species.term_ids,
            self._months_match(species, selection),
            self._colours_match(species, selection),
            self._sizes_match(species, selection),
        )
        return all(checks)

    def _months_match(self, species: SpeciesFacets, selection: Selection) -> bool:
        if not selection.months:
            return True
        return any(month_in_period(species.period, month) for month in selection.months)

    def _colours_match(self, species: SpeciesFacets, selection: Selection) -> bool:
        for part, hex_value in selection.colours.items():
            wanted = colours.nearest_colour(hex_value).key
            if wanted not in species.colours.get(part, frozenset()):
                return False
        return True

    def _sizes_match(self, species: SpeciesFacets, selection: Selection) -> bool:
        for key, (low, high) in selection.sizes.items():
            measured = species.measurements.get(key)
            if measured is None:
                return False
            m_low, m_high = measured
            if low is not None and m_high < low:
                return False
            if high is not None and m_low > high:
                return False
        return True

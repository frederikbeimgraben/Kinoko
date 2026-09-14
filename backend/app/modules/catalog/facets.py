"""Die Achsen des Filters: belegte Werte und der Abgleich je Art."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from app.modules.catalog import colours
from app.modules.catalog.schemas import FacetsOut
from app.shared.enums import BodyPart, CapShape, Dimension, Edibility, HymeniumType

if TYPE_CHECKING:
    from collections.abc import Sequence


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

    def catalogue(self, species: Sequence[SpeciesFacets]) -> FacetsOut:
        """Baut die belegten Werte je Achse aus dem ganzen Bestand."""
        colour_axes: dict[BodyPart, set[str]] = {}
        for entry in species:
            for part, keys in entry.colours.items():
                colour_axes.setdefault(part, set()).update(keys)
        months: set[int] = set()
        for entry in species:
            if entry.period is not None:
                months.update(m for m in range(1, 13) if month_in_period(entry.period, m))
        terms: set[uuid.UUID] = set()
        for entry in species:
            terms.update(entry.term_ids)
        return FacetsOut(
            edibility=sorted({entry.edibility for entry in species}),
            hymenium=sorted({entry.hymenium for entry in species if entry.hymenium is not None}),
            cap_shape=sorted({shape for entry in species for shape in entry.cap_shapes}),
            colours={str(part): sorted(keys) for part, keys in colour_axes.items()},
            months=sorted(months),
            terms=sorted(terms),
        )

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

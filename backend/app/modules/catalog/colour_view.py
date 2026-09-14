"""Baut Farbgruppen und Verfärbungen einer Art für die Ausgabe."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.modules.catalog.colours import nearest_colour
from app.modules.catalog.schemas import ColourChange, ColourGroup, ColourValue, TermRef
from app.shared.enums import TriggerGroup

if TYPE_CHECKING:
    import uuid

    from app.models import SpeciesColour, SpeciesColourChange, Term
    from app.modules.catalog.children import ChildRows


def colour_value(row: SpeciesColour) -> ColourValue:
    """Baut eine Farbe mit ihrer nächsten Standardfarbe."""
    return ColourValue(name=row.name, hex=row.hex, nearest=nearest_colour(row.hex).hex)


def term_ref(term: Term) -> TermRef:
    """Baut den Verweis auf einen Begriff."""
    return TermRef(id=term.id, slug=term.slug, name=term.name)


def colour_groups(species_id: uuid.UUID, child: ChildRows) -> list[ColourGroup]:
    """Baut die Farbgruppen einer Art."""
    part_colours = child.colours.get(species_id, [])
    return [
        ColourGroup(
            part=row.part,
            mode=row.mode,
            colours=[colour_value(c) for c in part_colours if c.part == row.part],
        )
        for row in child.colour_ranges.get(species_id, [])
    ]


def _from_colour(row: SpeciesColourChange) -> ColourValue | None:
    """Baut die Ausgangsfarbe einer Verfärbung, falls angegeben."""
    if row.from_name is None or row.from_hex is None:
        return None
    return ColourValue(name=row.from_name, hex=row.from_hex)


def _kind(terms: list[Term]) -> TriggerGroup:
    """Die Gruppe einer Verfärbung kommt vom ersten Auslöser."""
    for term in terms:
        if term.group_key is not None:
            return term.group_key
    return TriggerGroup.MECHANICAL


def colour_changes(
    species_id: uuid.UUID,
    child: ChildRows,
    terms: dict[uuid.UUID, Term],
) -> list[ColourChange]:
    """Baut die Verfärbungen einer Art mit ihren Auslösern."""
    result: list[ColourChange] = []
    for row in child.colour_changes.get(species_id, []):
        triggers = child.triggers.get((species_id, row.position), [])
        found = [terms[t.term_id] for t in triggers if t.term_id in terms]
        result.append(
            ColourChange.model_validate(
                {
                    "part": row.part,
                    "kind": _kind(found),
                    "from": _from_colour(row),
                    "to": ColourValue(name=row.to_name, hex=row.to_hex),
                    "speed": row.speed,
                    "triggers": [term_ref(term) for term in found],
                },
            ),
        )
    return result

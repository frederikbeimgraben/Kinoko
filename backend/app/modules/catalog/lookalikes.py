"""Löst die andere Art eines Verwechslungspaars auf."""

from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models import Species, SpeciesColour
from app.modules.catalog.colours import nearest_colour
from app.modules.catalog.schemas import ColourValue, Lookalike
from app.shared.enums import BodyPart, Edibility

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import SpeciesLookalike
    from app.modules.catalog.children import ChildRows


@dataclass(frozen=True, slots=True)
class LookalikeTarget:
    """Die Angaben der anderen Art eines Verwechslungspaars."""

    slug: str
    name: str
    latin_name: str
    edibility: Edibility
    cap_colours: list[ColourValue]


def _cap_colours(rows: Sequence[SpeciesColour]) -> list[ColourValue]:
    """Baut die Hutfarben einer Art mit ihrer nächsten Standardfarbe."""
    return [
        ColourValue(name=row.name, hex=row.hex, nearest=nearest_colour(row.hex).hex)
        for row in rows
        if row.part == BodyPart.CAP
    ]


def targets_of(
    species_rows: Sequence[Species], child: ChildRows
) -> dict[uuid.UUID, LookalikeTarget]:
    """Baut Verwechslungsziele aus bereits geladenen Arten, ohne neue Abfrage."""
    return {
        row.id: LookalikeTarget(
            slug=row.slug,
            name=row.name,
            latin_name=row.latin_name,
            edibility=row.edibility,
            cap_colours=_cap_colours(child.colours.get(row.id, [])),
        )
        for row in species_rows
    }


async def load_targets(
    db: AsyncSession,
    self_id: uuid.UUID,
    rows: Sequence[SpeciesLookalike],
) -> dict[uuid.UUID, LookalikeTarget]:
    """Lädt Verwechslungsziele für eine einzelne Art in zwei Abfragen."""
    other_ids = {
        (row.species_b_id if row.species_a_id == self_id else row.species_a_id) for row in rows
    }
    if not other_ids:
        return {}
    others = list((await db.execute(select(Species).where(Species.id.in_(other_ids)))).scalars())
    colour_rows = list(
        (
            await db.execute(
                select(SpeciesColour)
                .where(SpeciesColour.species_id.in_(other_ids), SpeciesColour.part == BodyPart.CAP)
                .order_by(SpeciesColour.species_id, SpeciesColour.position),
            )
        ).scalars(),
    )
    by_species: dict[uuid.UUID, list[SpeciesColour]] = defaultdict(list)
    for row in colour_rows:
        by_species[row.species_id].append(row)
    return {
        row.id: LookalikeTarget(
            slug=row.slug,
            name=row.name,
            latin_name=row.latin_name,
            edibility=row.edibility,
            cap_colours=_cap_colours(by_species.get(row.id, [])),
        )
        for row in others
    }


def build(
    species_id: uuid.UUID,
    rows: Sequence[SpeciesLookalike],
    targets: dict[uuid.UUID, LookalikeTarget],
) -> list[Lookalike]:
    """Baut die verwechselbaren Arten aus der eigenen Sicht."""
    result: list[Lookalike] = []
    for row in rows:
        if row.species_a_id == species_id:
            other_id, difference = row.species_b_id, row.difference_b
        else:
            other_id, difference = row.species_a_id, row.difference_a
        target = targets.get(other_id)
        if target is None:
            continue
        result.append(
            Lookalike(
                slug=target.slug,
                name=target.name,
                scientific_name=target.latin_name,
                edibility=target.edibility,
                cap_colours=target.cap_colours,
                difference=difference,
            ),
        )
    return result

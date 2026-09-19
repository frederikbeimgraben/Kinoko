"""Liest die Kindzeilen mehrerer Arten in wenigen Abfragen."""

from __future__ import annotations

import uuid
from collections import defaultdict
from itertools import groupby
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models import (
    SpeciesColour,
    SpeciesColourChange,
    SpeciesColourChangeTrigger,
    SpeciesColourRange,
    SpeciesLookalike,
    SpeciesMeasurement,
    SpeciesName,
    SpeciesPartFeature,
    SpeciesPartNote,
    SpeciesSeason,
    SpeciesSource,
    SpeciesTerm,
    SpeciesTrait,
)
from app.modules.photos.repository import PhotoRepository

if TYPE_CHECKING:
    from collections.abc import Sequence
    from typing import Any

    from sqlalchemy.ext.asyncio import AsyncSession


def _grouped[T](rows: Sequence[T], key: str) -> dict[uuid.UUID, list[T]]:
    """Gruppiert Zeilen nach ``species_id``, Reihenfolge bleibt erhalten."""
    found: dict[uuid.UUID, list[T]] = defaultdict(list)
    for row in rows:
        found[getattr(row, key)].append(row)
    return found


async def _rows[T](
    db: AsyncSession,
    model: type[T],
    ids: Sequence[uuid.UUID],
    *order: Any,  # noqa: ANN401
) -> Sequence[T]:
    query = select(model).where(model.species_id.in_(ids))  # type: ignore[attr-defined]
    if order:
        query = query.order_by(*order)
    return list((await db.execute(query)).scalars())


class ChildRows:
    """Die Kindzeilen mehrerer Arten, gebündelt nach Art."""

    def __init__(self, ids: Sequence[uuid.UUID]) -> None:
        self.ids = list(ids)
        self.names: dict[uuid.UUID, list[SpeciesName]] = {}
        self.measurements: dict[uuid.UUID, list[SpeciesMeasurement]] = {}
        self.colour_ranges: dict[uuid.UUID, list[SpeciesColourRange]] = {}
        self.colours: dict[uuid.UUID, list[SpeciesColour]] = {}
        self.colour_changes: dict[uuid.UUID, list[SpeciesColourChange]] = {}
        self.triggers: dict[tuple[uuid.UUID, int], list[SpeciesColourChangeTrigger]] = {}
        self.part_features: dict[uuid.UUID, list[SpeciesPartFeature]] = {}
        self.part_notes: dict[uuid.UUID, list[SpeciesPartNote]] = {}
        self.traits: dict[uuid.UUID, list[SpeciesTrait]] = {}
        self.sources: dict[uuid.UUID, list[SpeciesSource]] = {}
        self.seasons: dict[uuid.UUID, list[SpeciesSeason]] = {}
        self.terms: dict[uuid.UUID, list[SpeciesTerm]] = {}
        self.lookalikes: dict[uuid.UUID, list[SpeciesLookalike]] = {}
        self.lead_photos: dict[uuid.UUID, uuid.UUID] = {}


async def load_children(db: AsyncSession, ids: Sequence[uuid.UUID]) -> ChildRows:
    """Lädt alle Kindzeilen der gegebenen Arten in wenigen Abfragen."""
    found = ChildRows(ids)
    if not ids:
        return found
    found.names = _grouped(await _rows(db, SpeciesName, ids, SpeciesName.position), "species_id")
    found.measurements = _grouped(
        await _rows(db, SpeciesMeasurement, ids, SpeciesMeasurement.part),
        "species_id",
    )
    found.colour_ranges = _grouped(
        await _rows(db, SpeciesColourRange, ids, SpeciesColourRange.part),
        "species_id",
    )
    found.colours = _grouped(
        await _rows(db, SpeciesColour, ids, SpeciesColour.part, SpeciesColour.position),
        "species_id",
    )
    found.colour_changes = _grouped(
        await _rows(db, SpeciesColourChange, ids, SpeciesColourChange.position),
        "species_id",
    )
    trigger_rows = await _rows(db, SpeciesColourChangeTrigger, ids)
    trigger_rows = sorted(trigger_rows, key=lambda row: (row.species_id, row.position))
    found.triggers = {
        key: list(group)
        for key, group in groupby(trigger_rows, key=lambda row: (row.species_id, row.position))
    }
    found.part_features = _grouped(await _rows(db, SpeciesPartFeature, ids), "species_id")
    found.part_notes = _grouped(
        await _rows(db, SpeciesPartNote, ids, SpeciesPartNote.part), "species_id"
    )
    found.traits = _grouped(await _rows(db, SpeciesTrait, ids), "species_id")
    found.sources = _grouped(
        await _rows(db, SpeciesSource, ids, SpeciesSource.position), "species_id"
    )
    found.seasons = _grouped(await _rows(db, SpeciesSeason, ids), "species_id")
    found.terms = _grouped(await _rows(db, SpeciesTerm, ids), "species_id")
    found.lookalikes = await _lookalikes(db, ids)
    found.lead_photos = await PhotoRepository(db).leads(ids)
    return found


async def _lookalikes(
    db: AsyncSession, ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, list[SpeciesLookalike]]:
    """Liest verwechselbare Arten aus beiden Richtungen des Paares."""
    query = select(SpeciesLookalike).where(
        SpeciesLookalike.species_a_id.in_(ids) | SpeciesLookalike.species_b_id.in_(ids),
    )
    rows = list((await db.execute(query)).scalars())
    wanted = set(ids)
    found: dict[uuid.UUID, list[SpeciesLookalike]] = defaultdict(list)
    for row in rows:
        if row.species_a_id in wanted:
            found[row.species_a_id].append(row)
        if row.species_b_id in wanted:
            found[row.species_b_id].append(row)
    return found

"""Die Zahlen eines Laufs für die kurze Ansicht."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, NamedTuple

from sqlalchemy import func, select

from app.models import PipelineRun, PipelineRunSpecies, Species
from app.modules.pipeline.schemas import PipelineRunSummary

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy.ext.asyncio import AsyncSession


class Tally(NamedTuple):
    """Arten, Datensätze und der Name der einzigen Art eines Laufs."""

    species_count: int
    record_count: int
    species_name: str | None


EMPTY = Tally(0, 0, None)


async def tally_of(db: AsyncSession, ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, Tally]:
    """Zählt Arten und Datensätze je Lauf und nennt eine einzelne Art."""
    query = (
        select(
            PipelineRunSpecies.run_id,
            func.count(),
            func.coalesce(func.sum(PipelineRunSpecies.record_count), 0),
            func.min(Species.name),
            func.max(Species.name),
        )
        .join(Species, Species.id == PipelineRunSpecies.species_id)
        .where(PipelineRunSpecies.run_id.in_(ids))
        .group_by(PipelineRunSpecies.run_id)
    )
    out: dict[uuid.UUID, Tally] = {}
    for run_id, count, records, first, last in await db.execute(query):
        alone = first if count == 1 and first == last else None
        out[run_id] = Tally(count, records, alone)
    return out


def summary_of(run: PipelineRun, tally: dict[uuid.UUID, Tally]) -> PipelineRunSummary:
    """Baut die kurze Ansicht eines Laufs mit seinen Zahlen."""
    counted = tally.get(run.id, EMPTY)
    shown = PipelineRunSummary.model_validate(run)
    shown.species_count = counted.species_count
    shown.record_count = counted.record_count
    shown.species_name = counted.species_name
    shown.progress_done = run.progress_done
    shown.progress_total = run.progress_total
    return shown

"""Läufe der Vorhersagekette: Warteschlange, Fortschritt und Abschluss."""

from __future__ import annotations

import uuid
from collections import Counter
from pathlib import Path
from typing import TYPE_CHECKING, Any, Final, cast

from sqlalchemy import CursorResult, func, select, update

from app.core.errors import Invalid
from app.models import PipelineRun, PipelineRunFind, PipelineRunSpecies, Species, now
from app.modules.objects.find_service import FindService
from app.modules.pipeline.schemas import (
    PipelineRunDetail,
    PipelineRunSpeciesEntry,
    PipelineRunSummary,
)
from app.shared.enums import RunState
from app.shared.paging import wrap
from app.shared.repository import Repository

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import Find, User
    from app.shared.enums import RunKind
    from app.shared.paging import Paging

LOG_TAIL_DEFAULT: Final = 200
DONE: Final = (RunState.FINISHED, RunState.FAILED)
OPEN: Final = (RunState.QUEUED, RunState.RUNNING)


def run_state(value: str) -> RunState:
    """Liest einen Zustand, sonst Fehler mit Feld und Code."""
    try:
        return RunState(value)
    except ValueError as broken:
        raise Invalid(errors=[{"field": "state", "code": "enum"}]) from broken


def summary_of(run: PipelineRun) -> dict[str, object]:
    """Baut die kurze Ansicht eines Laufs."""
    return PipelineRunSummary.model_validate(run).dumped()


class PipelineRunService:
    """Läufe der Vorhersagekette."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.runs = Repository(db, PipelineRun)
        self.finds = FindService(db)

    async def queue(self, kind: RunKind, user: User) -> PipelineRun:
        """Legt einen Lauf mit einer Zeile je Art der Vorhersage an."""
        found = await self.db.execute(
            select(Species.id).where(Species.forecast_enabled.is_(True)),
        )
        species_ids = list(found.scalars())
        run = self.runs.add(
            PipelineRun(kind=kind, triggered_by_id=user.id, progress_total=len(species_ids)),
        )
        await self.db.flush()
        for species_id in species_ids:
            self.db.add(PipelineRunSpecies(run_id=run.id, species_id=species_id))
        await self.db.commit()
        await self.db.refresh(run)
        return run

    async def claim(self) -> PipelineRun | None:
        """Nimmt den ältesten wartenden Lauf und startet ihn."""
        tried: set[uuid.UUID] = set()
        while True:
            query = (
                select(PipelineRun.id)
                .where(PipelineRun.state == RunState.QUEUED, PipelineRun.id.not_in(tried))
                .order_by(PipelineRun.queued_at)
                .limit(1)
            )
            found = (await self.db.execute(query)).scalars().first()
            if found is None:
                return None
            tried.add(found)
            if await self.take(found):
                run = await self.runs.get_or_404(found)
                await self.db.refresh(run)
                await self.training_finds(run)
                return run

    async def take(self, run_id: uuid.UUID) -> bool:
        """Setzt einen wartenden Lauf auf ``running``, wenn niemand schneller war."""
        answer = await self.db.execute(
            update(PipelineRun)
            .where(PipelineRun.id == run_id, PipelineRun.state == RunState.QUEUED)
            .values(state=RunState.RUNNING, started_at=now()),
        )
        await self.db.commit()
        return cast("CursorResult[Any]", answer).rowcount == 1

    async def finish(self, run: PipelineRun, state: RunState, log_path: str | None) -> None:
        """Schließt einen Lauf ab und setzt sein Protokoll."""
        run.state = state
        run.finished_at = now()
        if log_path is not None:
            run.log_path = log_path
        await self.db.commit()

    async def report(
        self,
        run: PipelineRun,
        species_id: uuid.UUID,
        state: str,
        record_count: int,
    ) -> None:
        """Schreibt den Stand einer Art und zieht den Fortschritt des Laufs nach."""
        entry = await self.db.get(PipelineRunSpecies, (run.id, species_id))
        if entry is None:
            entry = PipelineRunSpecies(run_id=run.id, species_id=species_id)
            self.db.add(entry)
        entry.state = run_state(state)
        entry.record_count = record_count
        done = await self.db.execute(
            select(func.count())
            .select_from(PipelineRunSpecies)
            .where(PipelineRunSpecies.run_id == run.id, PipelineRunSpecies.state.in_(DONE)),
        )
        run.progress_done = done.scalar_one()
        await self.db.commit()

    @staticmethod
    def log(run: PipelineRun, tail: int = LOG_TAIL_DEFAULT) -> list[str]:
        """Liest die letzten Zeilen aus der Protokolldatei eines Laufs."""
        if not run.log_path:
            return []
        path = Path(run.log_path)
        if not path.is_file():
            return []
        lines = path.read_text(encoding="utf-8").splitlines()
        return lines[-tail:]

    async def cancel(self, run: PipelineRun) -> None:
        """Bricht einen wartenden oder laufenden Lauf ab."""
        if run.state not in OPEN:
            return
        run.state = RunState.FAILED
        run.finished_at = now()
        await self.db.commit()

    async def training_finds(self, run: PipelineRun | None = None) -> Sequence[Find]:
        """Liest die Funde für das Training und hält sie an einem Lauf fest."""
        found = await self.finds.training_finds()
        if run is not None:
            await self.link(run, found)
        return found

    async def link(self, run: PipelineRun, finds: Sequence[Find]) -> None:
        """Schreibt den Eingang eines Laufs und den Zähler je Art."""
        counted: Counter[uuid.UUID] = Counter()
        for find in finds:
            self.db.add(PipelineRunFind(run_id=run.id, find_id=find.id))
            if find.species_id is not None:
                counted[find.species_id] += 1
        for species_id, amount in counted.items():
            entry = await self.db.get(PipelineRunSpecies, (run.id, species_id))
            if entry is not None:
                entry.find_count = amount
        await self.db.commit()

    async def list_runs(self, paging: Paging) -> dict[str, object]:
        """Liest eine Seite Läufe, neueste zuerst."""
        found = await self.runs.list(
            self.runs.query().order_by(PipelineRun.queued_at.desc()),
            paging,
        )
        return wrap(found, paging, PipelineRunSummary.model_validate)

    async def detail(self, run: PipelineRun) -> dict[str, object]:
        """Baut den Stand eines Laufs mit dem Fortschritt je Art."""
        query = select(PipelineRunSpecies).where(PipelineRunSpecies.run_id == run.id)
        species = list((await self.db.execute(query)).scalars())
        summary = PipelineRunSummary.model_validate(run)
        return PipelineRunDetail(
            **summary.model_dump(),
            log_path=run.log_path,
            species=[PipelineRunSpeciesEntry.model_validate(row) for row in species],
        ).dumped()

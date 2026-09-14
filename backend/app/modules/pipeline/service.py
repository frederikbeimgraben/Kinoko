"""Läufe der Vorhersagekette: Warteschlange, Fortschritt und Abschluss."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Final

from sqlalchemy import func, select

from app.models import Find, PipelineRun, PipelineRunSpecies, Species, now
from app.modules.pipeline.schemas import (
    PipelineRunDetail,
    PipelineRunSpeciesEntry,
    PipelineRunSummary,
)
from app.shared.enums import ReviewState, RunState
from app.shared.paging import wrap
from app.shared.repository import Repository

if TYPE_CHECKING:
    import uuid
    from collections.abc import Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import User
    from app.shared.enums import RunKind
    from app.shared.paging import Paging

LOG_TAIL_DEFAULT: Final = 200


def summary_of(run: PipelineRun) -> dict[str, object]:
    """Baut die kurze Ansicht eines Laufs."""
    return PipelineRunSummary.model_validate(run).dumped()


class PipelineRunService:
    """Läufe der Vorhersagekette."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.runs = Repository(db, PipelineRun)

    async def queue(self, kind: RunKind, user: User) -> PipelineRun:
        """Legt einen Lauf im Zustand ``queued`` an."""
        total = await self.db.execute(
            select(func.count()).select_from(Species).where(Species.forecast_enabled.is_(True)),
        )
        run = self.runs.add(
            PipelineRun(kind=kind, triggered_by_id=user.id, progress_total=total.scalar_one()),
        )
        await self.db.commit()
        await self.db.refresh(run)
        return run

    async def claim(self) -> PipelineRun | None:
        """Nimmt den ältesten wartenden Lauf und startet ihn."""
        query = (
            select(PipelineRun)
            .where(PipelineRun.state == RunState.QUEUED)
            .order_by(PipelineRun.queued_at)
            .limit(1)
        )
        run = (await self.db.execute(query)).scalars().first()
        if run is None:
            return None
        run.state = RunState.RUNNING
        run.started_at = now()
        await self.db.commit()
        await self.db.refresh(run)
        return run

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
        entry.state = RunState(state)
        entry.record_count = record_count
        total = await self.db.execute(
            select(func.count())
            .select_from(PipelineRunSpecies)
            .where(PipelineRunSpecies.run_id == run.id),
        )
        run.progress_done = total.scalar_one()
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
        if run.state not in {RunState.QUEUED, RunState.RUNNING}:
            return
        run.state = RunState.FAILED
        await self.db.commit()

    async def training_finds(self) -> Sequence[Find]:
        """Liest die Funde, die für das Training freigegeben sind."""
        query = select(Find).where(
            Find.for_training.is_(True),
            Find.review_state == ReviewState.ACCEPTED,
            Find.species_id.is_not(None),
            Find.deleted_at.is_(None),
        )
        return list((await self.db.execute(query)).scalars())

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

"""Die Zähler der Verwaltungsübersicht."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Select, func, select

from app.models import Find, Permission, Photo, PipelineRun, Role, Species, TextEntry, User
from app.shared.enums import PhotoState, ReviewState, RunState

if TYPE_CHECKING:
    from collections.abc import Iterable

    from sqlalchemy.ext.asyncio import AsyncSession


class SummaryService:
    """Zählt je Punkt der Übersicht. Ein Punkt ohne Recht bleibt ohne Zahl."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def counts(self, rights: Iterable[str]) -> dict[str, int]:
        """Die Zähler, die der Aufrufer sehen darf."""
        held = set(rights)
        out: dict[str, int] = {}
        if "text.edit" in held:
            out["texts"] = await self.one(select(func.count(func.distinct(TextEntry.key))))
        if "image.review" in held:
            out["photos"] = await self.one(select(func.count()).select_from(Photo))
            out["photosPending"] = await self.one(
                select(func.count()).select_from(Photo).where(Photo.state == PhotoState.SUBMITTED),
            )
        if "species.edit" in held:
            out["species"] = await self.one(select(func.count()).select_from(Species))
        if "role.manage" in held:
            out["roles"] = await self.one(select(func.count()).select_from(Role))
            out["permissions"] = await self.one(select(func.count()).select_from(Permission))
        if "role.assign" in held:
            out["people"] = await self.one(select(func.count()).select_from(User))
        if "find.review" in held:
            alive = Find.deleted_at.is_(None)
            out["finds"] = await self.one(select(func.count()).select_from(Find).where(alive))
            out["findsPending"] = await self.one(
                select(func.count())
                .select_from(Find)
                .where(alive, Find.review_state == ReviewState.OPEN),
            )
        if "run.manage" in held:
            out["runs"] = await self.one(select(func.count()).select_from(PipelineRun))
            out["runsRunning"] = await self.one(
                select(func.count())
                .select_from(PipelineRun)
                .where(PipelineRun.state.in_([RunState.QUEUED, RunState.RUNNING])),
            )
        return out

    async def one(self, query: Select[tuple[int]]) -> int:
        """Das Ergebnis einer Zählabfrage."""
        return (await self.db.execute(query)).scalar_one()

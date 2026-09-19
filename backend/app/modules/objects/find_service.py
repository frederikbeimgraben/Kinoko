"""Die Regeln der Funde: Listen, Ort runden, prüfen, Training."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Select, select

from app.models import Find, Species, now
from app.modules.access.group_service import GroupService
from app.modules.objects.repository import FindRepository
from app.modules.objects.schemas import FindSchema
from app.modules.objects.service import ObjectService
from app.shared.enums import Protection, ReviewDecision, ReviewState, Visibility
from app.shared.paging import Paging, page, rows, wrap

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.core.auth import Viewer
    from app.models import User


@dataclass(frozen=True, slots=True)
class FindQuery:
    """Die Filter der Fundliste."""

    mine: bool
    species_id: uuid.UUID | None
    box: tuple[float, float, float, float] | None
    since: datetime | None


def filtered(
    query: Select[tuple[Find]],
    species_id: uuid.UUID | None,
    box: tuple[float, float, float, float] | None,
) -> Select[tuple[Find]]:
    """Schränkt eine Abfrage auf Art und Rechteck ein."""
    if species_id is not None:
        query = query.where(Find.species_id == species_id)
    if box is not None:
        west, south, east, north = box
        query = query.where(Find.lon.between(west, east), Find.lat.between(south, north))
    return query


class FindService:
    """Alles, was über die gemeinsamen Objektregeln hinausgeht."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = FindRepository(db)
        self.objects: ObjectService[Find] = ObjectService(self.repo)

    async def protections(self, species_ids: set[uuid.UUID]) -> dict[uuid.UUID, Protection]:
        """Der Schutzstatus je Art."""
        if not species_ids:
            return {}
        query = select(Species.id, Species.protection).where(Species.id.in_(species_ids))
        return {row.id: row.protection for row in await self.db.execute(query)}

    def coarse_if_protected(self, protection: Protection) -> bool:
        """Sagt, ob der Ort gerundet abgegeben wird."""
        return protection != Protection.NONE

    async def shared(self, viewer: Viewer, paging: Paging, query: FindQuery) -> dict[str, Any]:
        """Die Funde der eigenen Gruppen, bei Schutz auf ein Kilometer gerundet."""
        held = await GroupService(self.db).my_ids(viewer.user)
        stmt = select(Find).where(
            Find.visibility == Visibility.SHARED,
            Find.group_id.in_(held),
            Find.deleted_at.is_(None),
        )
        if viewer.user is not None:
            stmt = stmt.where(Find.owner_id != viewer.user.id)
        if query.since is not None:
            stmt = stmt.where(Find.updated_at > query.since)
        found = await rows(self.db, filtered(stmt, query.species_id, query.box), paging)
        levels = await self.protections({f.species_id for f in found if f.species_id is not None})

        def out(entity: Find) -> FindSchema:
            level = levels.get(entity.species_id, Protection.NONE) if entity.species_id else None
            return FindSchema.of(entity, coarse=self.coarse_if_protected(level or Protection.NONE))

        return wrap(found, paging, out)

    async def own(self, user: User, paging: Paging, query: FindQuery) -> dict[str, Any]:
        """Die eigenen Funde, geblättert."""
        stmt = (
            self.objects.since_query(user, query.since)
            if query.since is not None
            else self.objects.own_query(user)
        )
        out: Callable[[Find], FindSchema] = FindSchema.of
        return await page(self.db, filtered(stmt, query.species_id, query.box), paging, out)

    def apply_review(self, find: Find, reviewer: User, decision: ReviewDecision) -> Find:
        """Setzt Zustand, Prüfer und Zeitpunkt an einem Fund."""
        find.review_state = ReviewState(decision.value)
        find.reviewed_by_id = reviewer.id
        find.reviewed_at = now()
        find.updated_at = now()
        return find

    async def review(self, find_id: uuid.UUID, reviewer: User, decision: ReviewDecision) -> Find:
        """Prüft einen Fund, gleich wem er gehört."""
        found = await self.repo.get_or_404(find_id)
        self.apply_review(found, reviewer, decision)
        await self.repo.commit()
        return found

    async def accept_all_open(self, reviewer: User) -> int:
        """Nimmt jeden offenen Fund an."""
        query = self.repo.query().where(
            Find.review_state == ReviewState.OPEN,
            Find.deleted_at.is_(None),
        )
        found = list((await self.db.execute(query)).scalars())
        for entity in found:
            self.apply_review(entity, reviewer, ReviewDecision.ACCEPTED)
        await self.repo.commit()
        return len(found)

    async def training_finds(self) -> Sequence[Find]:
        """Die angenommenen Trainingsfunde der Arten mit Vorhersage."""
        query = (
            select(Find)
            .join(Species, Species.id == Find.species_id)
            .where(
                Find.for_training.is_(True),
                Find.review_state == ReviewState.ACCEPTED,
                Find.deleted_at.is_(None),
                Species.forecast_enabled.is_(True),
            )
        )
        return list((await self.db.execute(query)).scalars())

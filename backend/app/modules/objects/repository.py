"""Der Zugang zu Fund, Marker, Zone und Kombination."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.models import Combination, Find, Marker, Zone
from app.shared.repository import OwnedRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class FindRepository(OwnedRepository[Find]):
    """Der Zugang zu Funden."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Find)


class MarkerRepository(OwnedRepository[Marker]):
    """Der Zugang zu Markern."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Marker)


class ZoneRepository(OwnedRepository[Zone]):
    """Der Zugang zu Zonen."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Zone)


class CombinationRepository(OwnedRepository[Combination]):
    """Der Zugang zu Kombinationen."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Combination)

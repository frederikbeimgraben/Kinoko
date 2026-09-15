"""Gattung und Familie je Taxon, in einer Abfrage."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models import Taxon
from app.shared.enums import TaxonRank

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import Species as SpeciesRow


class TaxonNames:
    """Liest den Namen der Gattung und der Familie zu einem Taxon."""

    def __init__(self, rows: dict[uuid.UUID, Taxon]) -> None:
        self._rows = rows

    def of(self, species: SpeciesRow) -> tuple[str, str | None]:
        """Gattung und Familie einer Art. Ohne Taxon zählt der lateinische Name."""
        node = self._rows.get(species.taxon_id) if species.taxon_id else None
        if node is None:
            return species.latin_name.split(" ")[0], None
        return self._named(node, TaxonRank.GENUS) or "", self._named(node, TaxonRank.FAMILY)

    def _named(self, node: Taxon, rank: TaxonRank) -> str | None:
        """Steigt vom Knoten auf und hält bei dem Rang."""
        seen: set[uuid.UUID] = set()
        while node.id not in seen:
            if node.rank == rank:
                return node.name
            seen.add(node.id)
            parent = self._rows.get(node.parent_id) if node.parent_id else None
            if parent is None:
                return None
            node = parent
        return None


async def taxon_names(db: AsyncSession) -> TaxonNames:
    """Lädt alle Taxa und baut den Leser."""
    rows = (await db.execute(select(Taxon))).scalars()
    return TaxonNames({row.id: row for row in rows})

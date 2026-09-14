"""Baut die Taxon-Zeilen aus ``taxonomie.json``."""

from __future__ import annotations

import uuid
from typing import Any

from app.models import Taxon, new_id
from app.shared.enums import TaxonRank
from tools import catalog_vocabulary as vocab

RANK_ORDER: dict[str, int] = {
    TaxonRank.DIVISION: 0,
    TaxonRank.CLASS: 1,
    TaxonRank.ORDER: 2,
    TaxonRank.FAMILY: 3,
    TaxonRank.GENUS: 4,
}


def load_taxonomy(
    entries: list[dict[str, Any]],
) -> tuple[list[Taxon], dict[str, uuid.UUID], dict[tuple[str, str], uuid.UUID]]:
    """Baut die Taxon-Zeilen, die Kennung je JSON-Slug und die Gattungen."""
    ids = {entry["slug"]: new_id() for entry in entries}
    rows: list[Taxon] = []
    genus_ids: dict[tuple[str, str], uuid.UUID] = {}
    for entry in entries:
        rank = vocab.lookup(
            vocab.TAXON_RANK, entry["rang"], field="rang", source=f"taxonomie.json:{entry['slug']}"
        )
        slug = vocab.slugify(entry["lateinisch"])
        own_id = ids[entry["slug"]]
        parent = entry.get("elter")
        rows.append(
            Taxon(
                id=own_id,
                rank=rank,
                slug=slug,
                name=entry["name"],
                latin_name=entry["lateinisch"],
                parent_id=ids.get(parent) if parent else None,
            ),
        )
        if rank == TaxonRank.GENUS:
            genus_ids[(TaxonRank.GENUS, slug)] = own_id
    rows.sort(key=lambda row: RANK_ORDER[row.rank])
    return rows, ids, genus_ids

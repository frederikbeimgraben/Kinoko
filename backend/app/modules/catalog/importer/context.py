"""Baukontext des Katalogimports: Zählung, Begriffe, Profildaten."""

from __future__ import annotations

import uuid
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from app.models import Term
from tools import catalog_vocabulary as vocab


@dataclass(slots=True)
class Report:
    """Zählt geschriebene Zeilen und übersprungene Fälle."""

    counts: Counter[str] = field(default_factory=Counter)
    skipped: Counter[str] = field(default_factory=Counter)

    def skip(self, key: str) -> None:
        """Zählt einen übersprungenen Fall."""
        self.skipped[key] += 1


@dataclass(slots=True)
class TermRegistry:
    """Die Begriffe des Katalogs mit ihren Kennungen."""

    rows: list[Term]
    ids: dict[tuple[str, str], uuid.UUID]

    def id_for(self, kind: str, slug: str) -> uuid.UUID:
        """Liefert die Kennung eines Begriffs."""
        return self.ids[(kind, slug)]


@dataclass(slots=True)
class BuildContext:
    """Alles, was ein Profil braucht, um seine Zeilen zu bauen."""

    stem: str
    profile: dict[str, Any]
    species_id: uuid.UUID
    slug: str
    genus_ids: dict[tuple[str, str], uuid.UUID]
    terms: TermRegistry
    colours: dict[str, str]
    species_ids: dict[str, uuid.UUID]
    report: Report
    seen_pairs: set[tuple[uuid.UUID, uuid.UUID]]


def optional_lookup(
    table: dict[str, str], value: str | None, field_name: str, source: str
) -> str | None:
    """Schlägt einen optionalen Wert nach, ``None`` bleibt ``None``."""
    if value is None:
        return None
    return vocab.lookup(table, value, field=field_name, source=source)


def tree_entry(word: str) -> tuple[str, str]:
    """Findet Slug und Name eines Baums, oder meldet ihn als unbekannt."""
    try:
        return vocab.TREE[word]
    except KeyError as error:
        raise vocab.UnknownVocabulary(f"Unbekannter Baum '{word}'.") from error

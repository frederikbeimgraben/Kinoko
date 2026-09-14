"""Schemata der Begriffe."""

from __future__ import annotations

import uuid

from app.shared.enums import TermKind, TriggerGroup
from app.shared.schema import Schema


class Term(Schema):
    """Ein Begriff des Katalogs."""

    id: uuid.UUID
    kind: TermKind
    group: TriggerGroup | None = None
    slug: str
    name: str
    position: int


class TermCreate(Schema):
    """Ein neuer Begriff."""

    kind: TermKind
    group: TriggerGroup | None = None
    slug: str
    name: str
    position: int = 0


class TermUpdate(Schema):
    """Die Änderung eines Begriffs, teilweise."""

    name: str | None = None
    group: TriggerGroup | None = None
    position: int | None = None


__all__ = ["Term", "TermCreate", "TermUpdate"]

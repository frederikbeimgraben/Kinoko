"""Kleine Bausteine, die mehrere Schemata teilen."""

from __future__ import annotations

import uuid

from app.shared.enums import TermKind
from app.shared.schema import Schema


class TermRef(Schema):
    """Ein Begriff als Verweis."""

    id: uuid.UUID
    slug: str
    name: str
    kind: TermKind


class ColourValue(Schema):
    """Eine Farbe mit ihrer nächsten Standardfarbe."""

    name: str
    hex: str
    nearest: str | None = None


class StandardColourEntry(Schema):
    """Eine Standardfarbe der Palette."""

    key: str
    hex: str

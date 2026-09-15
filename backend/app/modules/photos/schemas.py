"""Die Schemata der Fotos."""

from __future__ import annotations

import uuid
from datetime import date

from pydantic import Field

from app.shared.enums import Licence, PhotoState
from app.shared.schema import Schema, Timestamp


class PhotoOut(Schema):
    """Ein Foto, in der Form des Vertrags."""

    id: uuid.UUID
    owner_id: uuid.UUID | None
    species_id: uuid.UUID | None
    find_id: uuid.UUID | None
    width: int
    height: int
    photographer: str
    owner_name: str
    licence: Licence
    caption: str | None
    source: str | None
    taken_on: date | None
    lat: float | None
    lon: float | None
    lead: bool
    state: PhotoState
    reject_reason: str | None
    reviewed_by_id: uuid.UUID | None
    reviewed_at: Timestamp | None
    created_at: Timestamp
    updated_at: Timestamp


class RejectionWrite(Schema):
    """Der Grund einer Ablehnung."""

    reason: str = Field(min_length=1, max_length=200)

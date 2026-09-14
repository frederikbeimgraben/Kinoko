"""Die Schemata des Moduls access: Konto, Rechte, Rollen, Personen."""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING, Literal

from pydantic import Field

from app.shared.enums import MarkerColour, ReviewState, Visibility
from app.shared.schema import Schema, Timestamp

if TYPE_CHECKING:
    from app.models import Find, Marker


class Me(Schema):
    """Das angemeldete Konto."""

    id: uuid.UUID
    sub: str
    email: str | None = None
    name: str | None = None


class MyPermissions(Schema):
    """Die Rechte des angemeldeten Kontos."""

    permissions: list[str]


class PermissionEntry(Schema):
    """Ein Recht mit seinem Bereich."""

    key: str
    area: str


class RoleBrief(Schema):
    """Eine Rolle, kurz."""

    id: uuid.UUID
    slug: str
    name: str


class Role(Schema):
    """Eine Rolle mit ihren Rechten."""

    id: uuid.UUID
    slug: str
    name: str
    description: str | None = None
    built_in: bool
    permissions: list[str]
    people_count: int
    created_at: Timestamp
    updated_at: Timestamp


class RoleCreate(Schema):
    """Eine neue Rolle."""

    slug: str = Field(pattern=r"^[a-z][a-z0-9-]*$")
    name: str
    description: str | None = None
    permissions: list[str] = Field(default_factory=list)


class RoleUpdate(Schema):
    """Die änderbaren Felder einer Rolle."""

    name: str | None = None
    description: str | None = None
    permissions: list[str] | None = None


class Person(Schema):
    """Ein Konto mit seinen Rollen."""

    id: uuid.UUID
    sub: str
    email: str | None = None
    name: str | None = None
    roles: list[RoleBrief]
    created_at: Timestamp


class SetPersonRoles(Schema):
    """Die neuen Rollen einer Person."""

    role_ids: list[uuid.UUID]


class GeoPolygon(Schema):
    """Eine Fläche als GeoJSON-Polygon."""

    kind: Literal["Polygon"] = Field(default="Polygon", alias="type")
    coordinates: list[list[list[float]]]


class Factor(Schema):
    """Ein Faktor einer Kombination."""

    source: str
    condition: str
    low: float | None = None
    high: float | None = None
    active: bool = True


class ExportFind(Schema):
    """Ein eigener Fund im Datenexport."""

    id: uuid.UUID
    owner_id: uuid.UUID
    species_id: uuid.UUID | None = None
    lat: float
    lon: float
    found_on: date
    count: int | None = None
    for_training: bool
    review_state: ReviewState
    reviewed_by_id: uuid.UUID | None = None
    reviewed_at: Timestamp | None = None
    visibility: Visibility
    note: str | None = None
    created_at: Timestamp
    updated_at: Timestamp
    deleted: bool = False

    @classmethod
    def of(cls, row: Find) -> ExportFind:
        """Baut den Eintrag aus einem Fund."""
        return cls(
            id=row.id,
            owner_id=row.owner_id,
            species_id=row.species_id,
            lat=row.lat,
            lon=row.lon,
            found_on=row.found_on,
            count=row.count,
            for_training=row.for_training,
            review_state=row.review_state,
            reviewed_by_id=row.reviewed_by_id,
            reviewed_at=row.reviewed_at,
            visibility=row.visibility,
            note=row.note,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


class ExportMarker(Schema):
    """Ein eigener Marker im Datenexport."""

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    lat: float
    lon: float
    colour: MarkerColour
    visibility: Visibility
    note: str | None = None
    created_at: Timestamp
    updated_at: Timestamp
    deleted: bool = False

    @classmethod
    def of(cls, row: Marker) -> ExportMarker:
        """Baut den Eintrag aus einem Marker."""
        return cls(
            id=row.id,
            owner_id=row.owner_id,
            name=row.name,
            lat=row.lat,
            lon=row.lon,
            colour=row.colour,
            visibility=row.visibility,
            note=row.note,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

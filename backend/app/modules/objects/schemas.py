"""Die Schemata von Fund, Marker, Zone und Kombination."""

from __future__ import annotations

import json
import uuid
from datetime import date
from typing import TYPE_CHECKING, Literal

from pydantic import Field

from app.shared.enums import Condition, MarkerColour, ReviewDecision, ReviewState, Rule, Visibility
from app.shared.geometry import coarse as coarse_point
from app.shared.schema import Schema, Timestamp

if TYPE_CHECKING:
    from app.models import Combination, Find, Marker, Zone
    from app.shared.geometry import Ring


class GeoPolygon(Schema):
    """Ein Polygon nach GeoJSON."""

    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]

    def outer_ring(self) -> Ring:
        """Der äußere Ring als Liste von Punkten."""
        return [(point[0], point[1]) for point in self.coordinates[0]]


class FindWrite(Schema):
    """Ein geschriebener Fund."""

    species_id: uuid.UUID | None = None
    lat: float
    lon: float
    found_on: date
    count: int | None = None
    for_training: bool = False
    visibility: Visibility = Visibility.PRIVATE
    note: str | None = None


class FindSchema(Schema):
    """Ein Fund nach außen."""

    id: uuid.UUID
    owner_id: uuid.UUID
    species_id: uuid.UUID | None
    lat: float
    lon: float
    found_on: date
    count: int | None
    for_training: bool
    review_state: ReviewState
    reviewed_by_id: uuid.UUID | None
    reviewed_at: Timestamp | None
    visibility: Visibility
    note: str | None
    created_at: Timestamp
    updated_at: Timestamp
    deleted: bool = False

    @classmethod
    def of(cls, row: Find, *, coarse: bool = False) -> FindSchema:
        """Baut das Schema aus einer Zeile, mit gerundetem Ort bei Bedarf."""
        lat, lon = row.lat, row.lon
        if coarse:
            lon, lat = coarse_point((lon, lat))
        return cls(
            id=row.id,
            owner_id=row.owner_id,
            species_id=row.species_id,
            lat=lat,
            lon=lon,
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
            deleted=row.deleted_at is not None,
        )


class ReviewBody(Schema):
    """Die Entscheidung einer Prüfung."""

    decision: ReviewDecision


class MarkerWrite(Schema):
    """Ein geschriebener Marker."""

    name: str
    lat: float
    lon: float
    colour: MarkerColour = MarkerColour.GREEN
    visibility: Visibility = Visibility.PRIVATE
    note: str | None = None


class MarkerSchema(Schema):
    """Ein Marker nach außen."""

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    lat: float
    lon: float
    colour: MarkerColour
    visibility: Visibility
    note: str | None
    created_at: Timestamp
    updated_at: Timestamp
    deleted: bool = False

    @classmethod
    def of(cls, row: Marker) -> MarkerSchema:
        """Baut das Schema aus einer Zeile."""
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
            deleted=row.deleted_at is not None,
        )


class ZoneWrite(Schema):
    """Eine geschriebene Zone."""

    name: str
    polygon: GeoPolygon
    colour: MarkerColour = MarkerColour.GREEN
    visibility: Visibility = Visibility.PRIVATE
    note: str | None = None


class ZoneSchema(Schema):
    """Eine Zone nach außen."""

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    polygon: GeoPolygon
    area_ha: float
    colour: MarkerColour
    visibility: Visibility
    note: str | None
    created_at: Timestamp
    updated_at: Timestamp
    deleted: bool = False

    @classmethod
    def of(cls, row: Zone) -> ZoneSchema:
        """Baut das Schema aus einer Zeile."""
        return cls(
            id=row.id,
            owner_id=row.owner_id,
            name=row.name,
            polygon=GeoPolygon.model_validate_json(row.polygon),
            area_ha=row.area_ha,
            colour=row.colour,
            visibility=row.visibility,
            note=row.note,
            created_at=row.created_at,
            updated_at=row.updated_at,
            deleted=row.deleted_at is not None,
        )


class ZoneValueSchema(Schema):
    """Der Vorhersagewert einer Zone."""

    species_id: uuid.UUID
    year: int
    week: int
    area_mean: float
    points: int
    own_finds: int


class FactorSchema(Schema):
    """Ein Faktor einer Kombination."""

    source: str
    condition: Condition
    low: float | None = None
    high: float | None = None
    active: bool = True


class CombinationWrite(Schema):
    """Eine geschriebene Kombination."""

    name: str
    rule: Rule
    factors: list[FactorSchema] = Field(min_length=1, max_length=8)


class CombinationSchema(Schema):
    """Eine Kombination nach außen."""

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    rule: Rule
    factors: list[FactorSchema]
    created_at: Timestamp
    updated_at: Timestamp
    deleted: bool = False

    @classmethod
    def of(cls, row: Combination) -> CombinationSchema:
        """Baut das Schema aus einer Zeile, die Faktoren aus JSON-Text."""
        return cls(
            id=row.id,
            owner_id=row.owner_id,
            name=row.name,
            rule=row.rule,
            factors=[FactorSchema.model_validate(item) for item in json.loads(row.factors)],
            created_at=row.created_at,
            updated_at=row.updated_at,
            deleted=row.deleted_at is not None,
        )

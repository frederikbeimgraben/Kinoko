"""Die Tabellen der Anwendung. Eine Wahrheit für ORM und Wanderung."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Final

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from app.shared.enums import (
    Area,
    BodyPart,
    CapShape,
    ColourMode,
    Dimension,
    Edibility,
    Frequency,
    GillAttachment,
    GillEdge,
    GillSpacing,
    Group,
    HymeniumType,
    Licence,
    MarkerColour,
    NameKind,
    PartFeature,
    Phase,
    PhotoState,
    Protection,
    RedListStatus,
    ReviewState,
    Rule,
    RunKind,
    RunState,
    Season,
    SourceScope,
    Speed,
    TaxonRank,
    TermKind,
    TraitKey,
    TriggerGroup,
    Unit,
    Visibility,
)

SLUG_LENGTH: Final = 80
NAME_LENGTH: Final = 120
HEX_LENGTH: Final = 7


class Utc(TypeDecorator[datetime]):
    """Ein Zeitstempel, der immer mit Zeitzone zurückkommt."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value: datetime | None, dialect: object) -> datetime | None:
        """Hängt UTC an einen Wert ohne Zeitzone."""
        _ = dialect
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value


def new_id() -> uuid.UUID:
    """Erzeugt den Schlüssel einer neuen Zeile."""
    return uuid.uuid4()


def now() -> datetime:
    """Der aktuelle Zeitpunkt, mit Zeitzone."""
    return datetime.now(UTC)


class Base(DeclarativeBase):
    """Basis aller Tabellen."""


def pk_id() -> Mapped[uuid.UUID]:
    """Ein Primärschlüssel aus einer UUID."""
    return mapped_column(Uuid, primary_key=True, default=new_id)


def stamp() -> Mapped[datetime]:
    """Ein Zeitstempel, der beim Schreiben mitläuft."""
    return mapped_column(Utc(), default=now, onupdate=now)


class User(Base):
    """Ein Konto aus dem SSO."""

    __tablename__ = "user"

    id: Mapped[uuid.UUID] = pk_id()
    sub: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(NAME_LENGTH))
    name: Mapped[str | None] = mapped_column(String(NAME_LENGTH))
    created_at: Mapped[datetime] = mapped_column(Utc(), default=now)


class Role(Base):
    """Eine Rolle mit Rechten."""

    __tablename__ = "role"

    id: Mapped[uuid.UUID] = pk_id()
    slug: Mapped[str] = mapped_column(String(SLUG_LENGTH), unique=True)
    name: Mapped[str] = mapped_column(String(NAME_LENGTH))
    description: Mapped[str | None] = mapped_column(Text)
    built_in: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(Utc(), default=now)
    updated_at: Mapped[datetime] = stamp()


class Permission(Base):
    """Ein Recht mit seinem Bereich."""

    __tablename__ = "permission"

    key: Mapped[str] = mapped_column(String(SLUG_LENGTH), primary_key=True)
    area: Mapped[Area] = mapped_column(String(20))


class RolePermission(Base):
    """Ein Recht an einer Rolle."""

    __tablename__ = "role_permission"

    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("role.id", ondelete="CASCADE"),
        primary_key=True,
    )
    permission_key: Mapped[str] = mapped_column(
        ForeignKey("permission.key", ondelete="CASCADE"),
        primary_key=True,
    )


class UserRole(Base):
    """Eine Rolle an einem Konto."""

    __tablename__ = "user_role"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("role.id", ondelete="CASCADE"),
        primary_key=True,
    )
    granted_at: Mapped[datetime] = mapped_column(Utc(), default=now)


class Taxon(Base):
    """Ein Knoten der Einordnung."""

    __tablename__ = "taxon"
    __table_args__ = (Index("ix_taxon_rank_slug", "rank", "slug", unique=True),)

    id: Mapped[uuid.UUID] = pk_id()
    rank: Mapped[TaxonRank] = mapped_column(String(20))
    slug: Mapped[str] = mapped_column(String(SLUG_LENGTH))
    name: Mapped[str] = mapped_column(String(NAME_LENGTH))
    latin_name: Mapped[str] = mapped_column(String(NAME_LENGTH))
    description: Mapped[str | None] = mapped_column(Text)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("taxon.id", ondelete="SET NULL"))


class Species(Base):
    """Eine Art des Katalogs."""

    __tablename__ = "species"

    id: Mapped[uuid.UUID] = pk_id()
    slug: Mapped[str] = mapped_column(String(SLUG_LENGTH), unique=True)
    name: Mapped[str] = mapped_column(String(NAME_LENGTH), unique=True)
    latin_name: Mapped[str] = mapped_column(String(NAME_LENGTH), unique=True)
    taxon_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("taxon.id", ondelete="SET NULL"))
    group_key: Mapped[Group] = mapped_column(String(40))
    edibility: Mapped[Edibility] = mapped_column(String(30))
    marketable: Mapped[bool] = mapped_column(Boolean, default=False)
    forecast_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    frequency: Mapped[Frequency | None] = mapped_column(String(20))
    red_list: Mapped[RedListStatus | None] = mapped_column(String(30))
    description: Mapped[str | None] = mapped_column(Text)
    edibility_note: Mapped[str | None] = mapped_column(Text)
    protection: Mapped[Protection] = mapped_column(String(20), default=Protection.NONE)
    protection_note: Mapped[str | None] = mapped_column(Text)
    period_start_month: Mapped[int | None] = mapped_column(Integer)
    period_end_month: Mapped[int | None] = mapped_column(Integer)
    period_peak_month: Mapped[int | None] = mapped_column(Integer)
    smell_text: Mapped[str | None] = mapped_column(Text)
    taste_text: Mapped[str | None] = mapped_column(Text)
    hymenium_type: Mapped[HymeniumType | None] = mapped_column(String(20))
    gill_attachment: Mapped[GillAttachment | None] = mapped_column(String(20))
    gill_spacing: Mapped[GillSpacing | None] = mapped_column(String(20))
    gill_edge: Mapped[GillEdge | None] = mapped_column(String(20))
    cap_shape_young: Mapped[CapShape | None] = mapped_column(String(20))
    cap_shape_old: Mapped[CapShape | None] = mapped_column(String(20))
    updated_at: Mapped[datetime] = stamp()
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"),
    )


class SpeciesName(Base):
    """Ein weiterer Name einer Art."""

    __tablename__ = "species_name"

    species_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(NAME_LENGTH))
    kind: Mapped[NameKind] = mapped_column(String(20))


class SpeciesMeasurement(Base):
    """Ein Maß eines Körperteils."""

    __tablename__ = "species_measurement"

    species_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )
    part: Mapped[BodyPart] = mapped_column(String(20), primary_key=True)
    dimension: Mapped[Dimension] = mapped_column(String(20), primary_key=True)
    low: Mapped[float] = mapped_column(Float)
    high: Mapped[float] = mapped_column(Float)
    rare_low: Mapped[float | None] = mapped_column(Float)
    rare_high: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[Unit] = mapped_column(String(10))


class SpeciesColourRange(Base):
    """Die Lesart der Farben eines Körperteils."""

    __tablename__ = "species_colour_range"

    species_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )
    part: Mapped[BodyPart] = mapped_column(String(20), primary_key=True)
    mode: Mapped[ColourMode] = mapped_column(String(20), default=ColourMode.DISTINCT)


class SpeciesColour(Base):
    """Eine Farbe eines Körperteils."""

    __tablename__ = "species_colour"
    __table_args__ = (
        ForeignKeyConstraint(
            ["species_id", "part"],
            ["species_colour_range.species_id", "species_colour_range.part"],
            ondelete="CASCADE",
        ),
    )

    species_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    part: Mapped[BodyPart] = mapped_column(String(20), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(NAME_LENGTH))
    hex: Mapped[str] = mapped_column(String(HEX_LENGTH))


class SpeciesColourChange(Base):
    """Eine Verfärbung eines Körperteils."""

    __tablename__ = "species_colour_change"

    species_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    part: Mapped[BodyPart] = mapped_column(String(20))
    from_name: Mapped[str | None] = mapped_column(String(NAME_LENGTH))
    from_hex: Mapped[str | None] = mapped_column(String(HEX_LENGTH))
    to_name: Mapped[str] = mapped_column(String(NAME_LENGTH))
    to_hex: Mapped[str] = mapped_column(String(HEX_LENGTH))
    speed: Mapped[Speed | None] = mapped_column(String(20))


class SpeciesColourChangeTrigger(Base):
    """Ein Auslöser einer Verfärbung."""

    __tablename__ = "species_colour_change_trigger"
    __table_args__ = (
        ForeignKeyConstraint(
            ["species_id", "position"],
            ["species_colour_change.species_id", "species_colour_change.position"],
            ondelete="CASCADE",
        ),
    )

    species_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    term_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("term.id", ondelete="CASCADE"),
        primary_key=True,
    )


class SpeciesPartFeature(Base):
    """Ein Merkmal eines Körperteils, je Phase."""

    __tablename__ = "species_part_feature"

    species_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )
    part: Mapped[BodyPart] = mapped_column(String(20), primary_key=True)
    feature: Mapped[PartFeature] = mapped_column(String(30), primary_key=True)
    phase: Mapped[Phase] = mapped_column(String(10), primary_key=True)


class SpeciesTrait(Base):
    """Ein Abschnitt der Merkmalsprosa."""

    __tablename__ = "species_trait"

    species_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )
    key: Mapped[TraitKey] = mapped_column(String(30), primary_key=True)
    body: Mapped[str] = mapped_column(Text)


class SpeciesSource(Base):
    """Eine Quelle einer Art."""

    __tablename__ = "species_source"

    species_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    scope: Mapped[SourceScope] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(NAME_LENGTH))
    url: Mapped[str] = mapped_column(Text)
    checked_on: Mapped[date] = mapped_column(Date)


class SpeciesSeason(Base):
    """Eine Jahreszeit einer Art."""

    __tablename__ = "species_season"

    species_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )
    season: Mapped[Season] = mapped_column(String(20), primary_key=True)


class SpeciesTerm(Base):
    """Ein Begriff an einer Art."""

    __tablename__ = "species_term"

    species_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )
    term_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("term.id", ondelete="CASCADE"),
        primary_key=True,
    )
    from_experience: Mapped[bool] = mapped_column(Boolean, default=False)


class SpeciesLookalike(Base):
    """Ein Paar verwechselbarer Arten."""

    __tablename__ = "species_lookalike"
    __table_args__ = (CheckConstraint("species_a_id < species_b_id", name="ck_lookalike_order"),)

    species_a_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )
    species_b_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )
    difference_a: Mapped[str | None] = mapped_column(Text)
    difference_b: Mapped[str | None] = mapped_column(Text)


class Term(Base):
    """Ein Begriff des Katalogs."""

    __tablename__ = "term"
    __table_args__ = (Index("ix_term_kind_slug", "kind", "slug", unique=True),)

    id: Mapped[uuid.UUID] = pk_id()
    kind: Mapped[TermKind] = mapped_column(String(20))
    group_key: Mapped[TriggerGroup | None] = mapped_column(String(20))
    slug: Mapped[str] = mapped_column(String(SLUG_LENGTH))
    name: Mapped[str] = mapped_column(String(NAME_LENGTH))
    position: Mapped[int] = mapped_column(Integer, default=0)


class Find(Base):
    """Ein Fund einer Person."""

    __tablename__ = "find"
    __table_args__ = (Index("ix_find_owner_updated", "owner_id", "updated_at"),)

    id: Mapped[uuid.UUID] = pk_id()
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))
    species_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("species.id", ondelete="SET NULL"),
    )
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    found_on: Mapped[date] = mapped_column(Date)
    count: Mapped[int | None] = mapped_column(Integer)
    for_training: Mapped[bool] = mapped_column(Boolean, default=False)
    review_state: Mapped[ReviewState] = mapped_column(String(20), default=ReviewState.OPEN)
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"),
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(Utc())
    visibility: Mapped[Visibility] = mapped_column(String(20), default=Visibility.PRIVATE)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(Utc(), default=now)
    updated_at: Mapped[datetime] = stamp()
    deleted_at: Mapped[datetime | None] = mapped_column(Utc())


class Photo(Base):
    """Ein Foto zu einem Fund oder zu einer Art."""

    __tablename__ = "photo"
    __table_args__ = (Index("ix_photo_species_state", "species_id", "state"),)

    id: Mapped[uuid.UUID] = pk_id()
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"))
    find_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("find.id", ondelete="SET NULL"))
    species_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
    )
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    photographer: Mapped[str] = mapped_column(String(NAME_LENGTH))
    licence: Mapped[Licence] = mapped_column(String(20))
    source: Mapped[str | None] = mapped_column(Text)
    taken_on: Mapped[date | None] = mapped_column(Date)
    caption: Mapped[str | None] = mapped_column(String(200))
    lat: Mapped[float | None] = mapped_column(Float)
    lon: Mapped[float | None] = mapped_column(Float)
    lead: Mapped[bool] = mapped_column(Boolean, default=False)
    state: Mapped[PhotoState] = mapped_column(String(20), default=PhotoState.PRIVATE)
    reject_reason: Mapped[str | None] = mapped_column(String(200))
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"),
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(Utc())
    created_at: Mapped[datetime] = mapped_column(Utc(), default=now)
    updated_at: Mapped[datetime] = stamp()


class Marker(Base):
    """Ein Marker einer Person."""

    __tablename__ = "marker"
    __table_args__ = (Index("ix_marker_owner_updated", "owner_id", "updated_at"),)

    id: Mapped[uuid.UUID] = pk_id()
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(NAME_LENGTH))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    colour: Mapped[MarkerColour] = mapped_column(String(20), default=MarkerColour.GREEN)
    visibility: Mapped[Visibility] = mapped_column(String(20), default=Visibility.PRIVATE)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(Utc(), default=now)
    updated_at: Mapped[datetime] = stamp()
    deleted_at: Mapped[datetime | None] = mapped_column(Utc())


class Zone(Base):
    """Eine Zone einer Person."""

    __tablename__ = "zone"
    __table_args__ = (Index("ix_zone_owner_updated", "owner_id", "updated_at"),)

    id: Mapped[uuid.UUID] = pk_id()
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(NAME_LENGTH))
    polygon: Mapped[str] = mapped_column(Text)
    area_ha: Mapped[float] = mapped_column(Float, default=0.0)
    colour: Mapped[MarkerColour] = mapped_column(String(20), default=MarkerColour.GREEN)
    visibility: Mapped[Visibility] = mapped_column(String(20), default=Visibility.PRIVATE)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(Utc(), default=now)
    updated_at: Mapped[datetime] = stamp()
    deleted_at: Mapped[datetime | None] = mapped_column(Utc())


class Combination(Base):
    """Eine Kombination von Faktoren."""

    __tablename__ = "combination"
    __table_args__ = (Index("ix_combination_owner_updated", "owner_id", "updated_at"),)

    id: Mapped[uuid.UUID] = pk_id()
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(NAME_LENGTH))
    rule: Mapped[Rule] = mapped_column(String(20), default=Rule.INTERSECTION)
    factors: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(Utc(), default=now)
    updated_at: Mapped[datetime] = stamp()
    deleted_at: Mapped[datetime | None] = mapped_column(Utc())


class TextEntry(Base):
    """Ein Text je Schlüssel und Sprache."""

    __tablename__ = "text"

    key: Mapped[str] = mapped_column(String(NAME_LENGTH), primary_key=True)
    locale: Mapped[str] = mapped_column(String(10), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = stamp()
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"),
    )


class PipelineRun(Base):
    """Ein Lauf der Kette."""

    __tablename__ = "pipeline_run"

    id: Mapped[uuid.UUID] = pk_id()
    kind: Mapped[RunKind] = mapped_column(String(20))
    state: Mapped[RunState] = mapped_column(String(20), default=RunState.QUEUED)
    queued_at: Mapped[datetime] = mapped_column(Utc(), default=now)
    started_at: Mapped[datetime | None] = mapped_column(Utc())
    finished_at: Mapped[datetime | None] = mapped_column(Utc())
    log_path: Mapped[str | None] = mapped_column(Text)
    metric_brier: Mapped[float | None] = mapped_column(Float)
    progress_done: Mapped[int] = mapped_column(Integer, default=0)
    progress_total: Mapped[int] = mapped_column(Integer, default=0)
    triggered_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"),
    )


class PipelineRunStep(Base):
    """Ein Schritt eines Laufs."""

    __tablename__ = "pipeline_run_step"

    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipeline_run.id", ondelete="CASCADE"),
        primary_key=True,
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(NAME_LENGTH))
    state: Mapped[RunState] = mapped_column(String(20), default=RunState.QUEUED)
    duration_s: Mapped[int | None] = mapped_column(Integer)


class PipelineRunFind(Base):
    """Ein Fund im Eingang eines Laufs."""

    __tablename__ = "pipeline_run_find"

    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipeline_run.id", ondelete="CASCADE"),
        primary_key=True,
    )
    find_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("find.id", ondelete="CASCADE"),
        primary_key=True,
    )


class PipelineRunSpecies(Base):
    """Der Stand einer Art in einem Lauf."""

    __tablename__ = "pipeline_run_species"

    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipeline_run.id", ondelete="CASCADE"),
        primary_key=True,
    )
    species_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )
    state: Mapped[RunState] = mapped_column(String(20), default=RunState.QUEUED)
    record_count: Mapped[int] = mapped_column(Integer, default=0)
    find_count: Mapped[int] = mapped_column(Integer, default=0)

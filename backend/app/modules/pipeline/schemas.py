"""Die Schemata des Moduls pipeline."""

from __future__ import annotations

import uuid
from datetime import date

from app.shared.enums import RunKind, RunState
from app.shared.schema import Schema, Timestamp


class PipelineRunSummary(Schema):
    """Ein Lauf der Kette, kurz."""

    id: uuid.UUID
    kind: RunKind
    state: RunState
    queued_at: Timestamp
    started_at: Timestamp | None = None
    finished_at: Timestamp | None = None
    triggered_by_id: uuid.UUID | None = None


class PipelineRunSpeciesEntry(Schema):
    """Der Stand einer Art in einem Lauf."""

    species_id: uuid.UUID
    state: str
    record_count: int
    find_count: int


class PipelineRunStepEntry(Schema):
    """Der Stand eines Schritts in einem Lauf."""

    position: int
    name: str
    state: RunState
    duration_s: int | None


class PipelineRunDetail(PipelineRunSummary):
    """Ein Lauf der Kette mit Fortschritt, Schritten und Protokoll."""

    log_path: str | None = None
    metric_brier: float | None = None
    metric_brier_previous: float | None = None
    progress_done: int
    progress_total: int
    species: list[PipelineRunSpeciesEntry]
    steps: list[PipelineRunStepEntry]
    log_tail: list[str]


class RunCreate(Schema):
    """Der Auftrag für einen neuen Lauf."""

    kind: RunKind


class SpeciesReport(Schema):
    """Die Meldung einer Art in einem Lauf."""

    state: str
    record_count: int


class StepReport(Schema):
    """Die Meldung eines Schritts in einem Lauf."""

    name: str
    state: RunState
    duration_s: int | None


class RunFinish(Schema):
    """Der Abschluss eines Laufs."""

    state: RunState
    log_path: str | None = None
    metric_brier: float | None = None


class TrainingFind(Schema):
    """Ein Fund für das Training."""

    id: uuid.UUID
    species_id: uuid.UUID
    lat: float
    lon: float
    found_on: date
    count: int | None = None

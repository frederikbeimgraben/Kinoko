"""Die Endpunkte der Läufe und die internen Endpunkte der Kette."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Path, Response, status

from app.core.auth import CurrentUser, Db, requires
from app.core.errors import Unauthorized
from app.core.settings import get_settings
from app.models import PipelineRun
from app.modules.pipeline.schemas import RunCreate, RunFinish, SpeciesReport, TrainingFind
from app.modules.pipeline.service import PipelineRunService, summary_of
from app.shared.paging import Page
from app.shared.repository import Repository

router = APIRouter(tags=["pipeline-runs"])
internal_router = APIRouter(tags=["internal"])


async def internal_only(x_internal_token: Annotated[str | None, Header()] = None) -> None:
    """Dependency: prüft das interne Token der Kette."""
    if x_internal_token != get_settings().internal_token:
        raise Unauthorized


async def run_or_404(db: Db, run_id: Annotated[uuid.UUID, Path(alias="id")]) -> PipelineRun:
    """Dependency: liest einen Lauf, sonst 404."""
    return await Repository(db, PipelineRun).get_or_404(run_id)


InternalOnly = Depends(internal_only)
RunPath = Annotated[PipelineRun, Depends(run_or_404)]


@router.get("/pipeline-runs", dependencies=[requires("run.manage")])
async def list_pipeline_runs(db: Db, paging: Page) -> Any:  # noqa: ANN401
    """Liefert eine Seite Läufe."""
    return await PipelineRunService(db).list_runs(paging)


@router.post(
    "/pipeline-runs",
    status_code=status.HTTP_201_CREATED,
    dependencies=[requires("run.manage")],
)
async def create_pipeline_run(db: Db, user: CurrentUser, body: RunCreate) -> Any:  # noqa: ANN401
    """Legt einen Lauf an."""
    run = await PipelineRunService(db).queue(body.kind, user)
    return summary_of(run)


@router.get("/pipeline-runs/{id}", dependencies=[requires("run.manage")])  # noqa: FAST003
async def get_pipeline_run(db: Db, run: RunPath) -> Any:  # noqa: ANN401
    """Liest einen Lauf mit dem Stand je Art."""
    return await PipelineRunService(db).detail(run)


@internal_router.post("/internal/pipeline-runs/claim", dependencies=[InternalOnly])
async def claim_pipeline_run(db: Db, response: Response) -> Any:  # noqa: ANN401
    """Nimmt den ältesten wartenden Lauf."""
    run = await PipelineRunService(db).claim()
    if run is None:
        response.status_code = status.HTTP_204_NO_CONTENT
        return None
    return summary_of(run)


@internal_router.post(
    "/internal/pipeline-runs/{id}/species/{speciesId}",  # noqa: FAST003
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[InternalOnly],
)
async def report_pipeline_run_species(
    db: Db,
    run: RunPath,
    species_id: Annotated[uuid.UUID, Path(alias="speciesId")],
    body: SpeciesReport,
) -> None:
    """Meldet den Stand einer Art in einem Lauf."""
    await PipelineRunService(db).report(run, species_id, body.state, body.record_count)


@internal_router.post(
    "/internal/pipeline-runs/{id}/finish",  # noqa: FAST003
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[InternalOnly],
)
async def finish_pipeline_run(db: Db, run: RunPath, body: RunFinish) -> None:
    """Schließt einen Lauf ab."""
    await PipelineRunService(db).finish(run, body.state, body.log_path)


@internal_router.get("/internal/training-finds", dependencies=[InternalOnly])
async def list_training_finds(db: Db) -> Any:  # noqa: ANN401
    """Liefert die Funde, die für das Training freigegeben sind."""
    finds = await PipelineRunService(db).training_finds()
    return {"items": [TrainingFind.model_validate(find).dumped() for find in finds]}

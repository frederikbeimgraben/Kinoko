import uuid
from datetime import UTC, date, datetime
from pathlib import Path

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Find, PipelineRun, Species
from app.modules.pipeline.service import PipelineRunService
from app.shared.enums import Edibility, Group, ReviewState, RunKind, RunState
from tests.conftest import app_of, make_user, sign_in

INTERNAL_TOKEN = "geheim"  # noqa: S105


def species(slug: str, *, forecast_enabled: bool = True) -> Species:
    return Species(
        slug=slug,
        name=slug,
        latin_name=f"Latinus {slug}",
        group_key=Group.BOLETE,
        edibility=Edibility.EDIBLE,
        forecast_enabled=forecast_enabled,
    )


async def test_queue_sets_progress_total_from_forecast_species(session: AsyncSession) -> None:
    user = await make_user(session)
    session.add_all([species("a"), species("b"), species("c", forecast_enabled=False)])
    await session.commit()
    run = await PipelineRunService(session).queue(RunKind.TRAINING, user)
    assert run.state == RunState.QUEUED
    assert run.progress_total == 2
    assert run.triggered_by_id == user.id


async def test_claim_takes_the_oldest_queued_run(session: AsyncSession) -> None:
    user = await make_user(session)
    service = PipelineRunService(session)
    first = await service.queue(RunKind.TRAINING, user)
    await service.queue(RunKind.RENDER, user)
    claimed = await service.claim()
    assert claimed is not None
    assert claimed.id == first.id
    assert claimed.state == RunState.RUNNING
    assert claimed.started_at is not None


async def test_claim_returns_none_without_a_queued_run(session: AsyncSession) -> None:
    assert await PipelineRunService(session).claim() is None


async def test_finish_sets_state_and_log_path(session: AsyncSession) -> None:
    user = await make_user(session)
    service = PipelineRunService(session)
    run = await service.queue(RunKind.FULL, user)
    await service.finish(run, RunState.FINISHED, "/var/log/run.log")
    assert run.state == RunState.FINISHED
    assert run.finished_at is not None
    assert run.log_path == "/var/log/run.log"


async def test_finish_without_a_log_path_keeps_the_existing_one(session: AsyncSession) -> None:
    user = await make_user(session)
    service = PipelineRunService(session)
    run = await service.queue(RunKind.FULL, user)
    await service.finish(run, RunState.FINISHED, "/var/log/run.log")
    await service.finish(run, RunState.FAILED, None)
    assert run.log_path == "/var/log/run.log"


async def test_report_writes_species_state_and_advances_progress(session: AsyncSession) -> None:
    user = await make_user(session)
    a, b = species("a"), species("b")
    session.add_all([a, b])
    await session.commit()
    service = PipelineRunService(session)
    run = await service.queue(RunKind.TRAINING, user)
    await service.report(run, a.id, "finished", 12)
    assert run.progress_done == 1
    await service.report(run, a.id, "finished", 20)
    await service.report(run, b.id, "finished", 5)
    assert run.progress_done == 2


async def test_log_reads_the_tail_of_the_log_file(tmp_path: Path) -> None:
    log_file = tmp_path / "run.log"
    log_file.write_text("\n".join(f"line {i}" for i in range(5)), encoding="utf-8")
    run = PipelineRun(kind=RunKind.TRAINING, log_path=str(log_file))
    assert PipelineRunService.log(run, tail=2) == ["line 3", "line 4"]


async def test_log_without_a_log_path_is_empty() -> None:
    run = PipelineRun(kind=RunKind.TRAINING)
    assert PipelineRunService.log(run) == []


async def test_log_with_a_missing_file_is_empty() -> None:
    run = PipelineRun(kind=RunKind.TRAINING, log_path="/no/such/file.log")
    assert PipelineRunService.log(run) == []


async def test_cancel_fails_a_queued_run(session: AsyncSession) -> None:
    user = await make_user(session)
    service = PipelineRunService(session)
    run = await service.queue(RunKind.TRAINING, user)
    await service.cancel(run)
    assert run.state == RunState.FAILED


async def test_cancel_leaves_a_finished_run_alone(session: AsyncSession) -> None:
    user = await make_user(session)
    service = PipelineRunService(session)
    run = await service.queue(RunKind.TRAINING, user)
    await service.finish(run, RunState.FINISHED, None)
    await service.cancel(run)
    assert run.state == RunState.FINISHED


async def test_training_finds_filters_for_accepted_species_finds(session: AsyncSession) -> None:
    user = await make_user(session)
    target = species("a")
    session.add(target)
    await session.flush()
    common = {
        "owner_id": user.id,
        "species_id": target.id,
        "lat": 1.0,
        "lon": 2.0,
        "found_on": date(2026, 6, 1),
    }
    good = Find(**common, for_training=True, review_state=ReviewState.ACCEPTED)
    not_for_training = Find(**common, for_training=False, review_state=ReviewState.ACCEPTED)
    open_review = Find(**common, for_training=True, review_state=ReviewState.OPEN)
    no_species = Find(
        owner_id=user.id,
        lat=1.0,
        lon=2.0,
        found_on=date(2026, 6, 1),
        for_training=True,
        review_state=ReviewState.ACCEPTED,
    )
    deleted = Find(**common, for_training=True, review_state=ReviewState.ACCEPTED)
    deleted.deleted_at = datetime.now(UTC)
    session.add_all([good, not_for_training, open_review, no_species, deleted])
    await session.commit()

    found = await PipelineRunService(session).training_finds()
    assert [row.id for row in found] == [good.id]


async def test_create_pipeline_run_endpoint(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "run.manage")
    answer = await api.post("/pipeline-runs", json={"kind": "training"})
    assert answer.status_code == 201
    body = answer.json()
    assert body["kind"] == "training"
    assert body["state"] == "queued"


async def test_list_and_get_pipeline_run_endpoints(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "run.manage")
    created = await api.post("/pipeline-runs", json={"kind": "render"})
    run_id = created.json()["id"]

    listed = await api.get("/pipeline-runs")
    assert listed.status_code == 200
    assert run_id in {row["id"] for row in listed.json()["items"]}

    detail = await api.get(f"/pipeline-runs/{run_id}")
    assert detail.status_code == 200
    assert detail.json()["species"] == []


async def test_get_pipeline_run_is_not_found_for_an_unknown_id(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "run.manage")
    answer = await api.get(f"/pipeline-runs/{uuid.uuid4()}")
    assert answer.status_code == 404


async def test_internal_endpoints_need_the_internal_token(api: httpx.AsyncClient) -> None:
    answer = await api.post("/internal/pipeline-runs/claim")
    assert answer.status_code == 401
    wrong = await api.post(
        "/internal/pipeline-runs/claim",
        headers={"X-Internal-Token": "falsch"},
    )
    assert wrong.status_code == 401


async def test_claim_endpoint_returns_204_without_a_queued_run(api: httpx.AsyncClient) -> None:
    answer = await api.post(
        "/internal/pipeline-runs/claim",
        headers={"X-Internal-Token": INTERNAL_TOKEN},
    )
    assert answer.status_code == 204


async def test_claim_endpoint_returns_the_run(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    await PipelineRunService(session).queue(RunKind.TRAINING, user)
    answer = await api.post(
        "/internal/pipeline-runs/claim",
        headers={"X-Internal-Token": INTERNAL_TOKEN},
    )
    assert answer.status_code == 200
    assert answer.json()["state"] == "running"


async def test_report_and_finish_endpoints(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session)
    target = species("a")
    session.add(target)
    await session.commit()
    run = await PipelineRunService(session).queue(RunKind.TRAINING, user)
    headers = {"X-Internal-Token": INTERNAL_TOKEN}

    report = await api.post(
        f"/internal/pipeline-runs/{run.id}/species/{target.id}",
        json={"state": "finished", "recordCount": 7},
        headers=headers,
    )
    assert report.status_code == 204

    finish = await api.post(
        f"/internal/pipeline-runs/{run.id}/finish",
        json={"state": "finished", "logPath": "/var/log/run.log"},
        headers=headers,
    )
    assert finish.status_code == 204
    await session.refresh(run)
    assert run.state == RunState.FINISHED
    assert run.progress_done == 1


async def test_report_species_is_not_found_for_an_unknown_run(api: httpx.AsyncClient) -> None:
    answer = await api.post(
        f"/internal/pipeline-runs/{uuid.uuid4()}/species/{uuid.uuid4()}",
        json={"state": "finished", "recordCount": 1},
        headers={"X-Internal-Token": INTERNAL_TOKEN},
    )
    assert answer.status_code == 404


async def test_training_finds_endpoint(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session)
    target = species("a")
    session.add(target)
    await session.flush()
    find = Find(
        owner_id=user.id,
        species_id=target.id,
        lat=1.0,
        lon=2.0,
        found_on=date(2026, 6, 1),
        for_training=True,
        review_state=ReviewState.ACCEPTED,
    )
    session.add(find)
    await session.commit()

    answer = await api.get(
        "/internal/training-finds",
        headers={"X-Internal-Token": INTERNAL_TOKEN},
    )
    assert answer.status_code == 200
    assert [row["id"] for row in answer.json()["items"]] == [str(find.id)]

import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from app.core.settings import Settings, get_settings
from app.shared.enums import RunState
from tools import pipeline_worker as worker

RUN_ID = "11111111-1111-1111-1111-111111111111"
PORCINI = "22222222-2222-2222-2222-222222222222"
GHOST = "33333333-3333-3333-3333-333333333333"

LIST_SCRIPT = """#!/usr/bin/env bash
if [ -n "${LISTE:-}" ]; then
  printf 'boletus_edulis\tBoletus edulis\n'
  printf 'reizker\tLactarius deliciosus,Lactarius deterrimus\n'
  exit 0
fi
echo "visits with weather: 4711   positive: 12"
echo "NUR=$NUR"
"""


def chain(tmp_path: Path, *, broken: bool = False) -> Path:
    """Legt einen Kettenbaum mit beiden Stufen an."""
    root = tmp_path / "modell"
    root.mkdir()
    body = LIST_SCRIPT + ("exit 1\n" if broken else "")
    for name in ("run_all.sh", "render_de.sh"):
        (root / name).write_text(body, encoding="utf-8")
    return root


def settings_for(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, root: Path) -> Settings:
    monkeypatch.setenv("PILZE_CHAIN", str(root))
    monkeypatch.setenv("PILZE_RUN_LOGS", str(tmp_path / "runs"))
    get_settings.cache_clear()
    return get_settings()


class Fake:
    """Ein Dienst, der die Aufrufe des Arbeiters mitschreibt."""

    def __init__(
        self,
        species: list[dict[str, Any]],
        finds: list[dict[str, Any]],
        kind: str = "training",
    ) -> None:
        self.species = species
        self.finds = finds
        self.kind = kind
        self.reports: list[tuple[str, str, int]] = []
        self.steps: list[tuple[int, str, str, int | None]] = []
        self.finished: tuple[str, str] | None = None
        self.finished_metric: float | None = None
        self.claimed = True

    def handle_claim(self) -> httpx.Response:
        """Antwortet auf einen Anspruch."""
        if not self.claimed:
            return httpx.Response(204)
        return httpx.Response(200, json={"id": RUN_ID, "kind": self.kind})

    def handle_finish(self, request: httpx.Request) -> httpx.Response:
        """Merkt sich den Abschluss eines Laufs."""
        body = json.loads(request.content)
        self.finished = (body["state"], body["logPath"])
        self.finished_metric = body.get("metricBrier")
        return httpx.Response(204)

    def handle_step(self, request: httpx.Request, path: str) -> httpx.Response:
        """Merkt sich die Meldung einer Stufe."""
        body = json.loads(request.content)
        position = int(path.rsplit("/", 1)[1])
        self.steps.append((position, body["name"], body["state"], body["durationS"]))
        return httpx.Response(204)

    def handle_report(self, request: httpx.Request, path: str) -> httpx.Response:
        """Merkt sich die Meldung einer Art."""
        body = json.loads(request.content)
        self.reports.append((path.rsplit("/", 1)[1], body["state"], body["recordCount"]))
        return httpx.Response(204)

    def handle(self, request: httpx.Request) -> httpx.Response:
        """Antwortet auf jeden Aufruf des Arbeiters."""
        path = request.url.path
        if path.endswith("/claim"):
            return self.handle_claim()
        if path.endswith("/species"):
            return httpx.Response(200, json={"items": self.species, "nextCursor": None})
        if path.endswith("/training-finds"):
            return httpx.Response(200, json={"items": self.finds})
        if path.endswith("/finish"):
            return self.handle_finish(request)
        if "/steps/" in path:
            return self.handle_step(request, path)
        return self.handle_report(request, path)


REAL_CLIENT = httpx.Client


def patch_client(monkeypatch: pytest.MonkeyPatch, fake: Fake) -> None:
    """Lenkt jeden Klienten des Arbeiters auf den gefälschten Dienst."""
    transport = httpx.MockTransport(fake.handle)

    def build(*, base_url: str, timeout: float) -> httpx.Client:
        return REAL_CLIENT(transport=transport, base_url=base_url, timeout=timeout)

    monkeypatch.setattr(worker.httpx, "Client", build)


def api_of(fake: Fake, settings: Settings) -> tuple[worker.Api, httpx.Client]:
    client = httpx.Client(transport=httpx.MockTransport(fake.handle), base_url="http://test/api")
    return worker.Api(settings, client), client


def species_row(row_id: str, latin: str) -> dict[str, Any]:
    return {"id": row_id, "slug": latin.lower().replace(" ", "-"), "scientificName": latin}


def test_records_in_reads_the_last_count() -> None:
    assert worker.records_in("visits with weather: 12\nvisits with weather: 34  positive: 1") == 34


def test_records_in_without_a_line_is_zero() -> None:
    assert worker.records_in("nothing here") == 0


def test_brier_in_reads_the_calibrated_value() -> None:
    text = "Brier score   raw 0.30000   calibrated 0.18000"
    assert worker.brier_in(text) == pytest.approx(0.18)


def test_brier_in_without_a_line_is_none() -> None:
    assert worker.brier_in("nothing here") is None


def test_chain_names_maps_every_latin_name(tmp_path: Path) -> None:
    names = worker.chain_names(chain(tmp_path))
    assert names["boletus edulis"] == "boletus_edulis"
    assert names["lactarius deterrimus"] == "reizker"


def test_write_finds_keeps_only_species_with_a_name(tmp_path: Path) -> None:
    root = chain(tmp_path)
    finds = [
        {"id": "f1", "speciesId": PORCINI, "lat": 1.0, "lon": 2.0, "foundOn": "2026-06-01"},
        {"id": "f2", "speciesId": GHOST, "lat": 1.0, "lon": 2.0, "foundOn": "2026-06-02"},
    ]
    target = worker.write_finds(root, finds, {PORCINI: "Boletus edulis"})
    items = json.loads(target.read_text(encoding="utf-8"))["items"]
    assert [row["id"] for row in items] == ["f1"]
    assert items[0]["scientificName"] == "Boletus edulis"


def test_main_returns_zero_without_a_queued_run(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = Fake([], [])
    fake.claimed = False
    settings = settings_for(tmp_path, monkeypatch, chain(tmp_path))
    api, client = api_of(fake, settings)
    with client:
        assert api.claim() is None


def test_work_reports_every_species_and_finishes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = chain(tmp_path)
    settings = settings_for(tmp_path, monkeypatch, root)
    fake = Fake(
        [
            {**species_row(PORCINI, "Boletus edulis"), "forecastEnabled": True},
            {**species_row(GHOST, "Amanita phalloides"), "forecastEnabled": True},
        ],
        [{"id": "f1", "speciesId": PORCINI, "lat": 1.0, "lon": 2.0, "foundOn": "2026-06-01"}],
    )
    api, client = api_of(fake, settings)
    with client:
        assert worker.work(api, settings, {"id": RUN_ID, "kind": "training"}) == 0

    assert (PORCINI, "running", 0) in fake.reports
    assert (PORCINI, "finished", 4711) in fake.reports
    assert (GHOST, "failed", 0) in fake.reports
    assert fake.finished is not None
    assert fake.finished[0] == RunState.FAILED.value
    assert Path(fake.finished[1]).is_file()


def test_work_skips_species_without_forecast(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = chain(tmp_path)
    settings = settings_for(tmp_path, monkeypatch, root)
    fake = Fake(
        [
            {**species_row(PORCINI, "Boletus edulis"), "forecastEnabled": True},
            {**species_row(GHOST, "Amanita phalloides"), "forecastEnabled": False},
        ],
        [],
    )
    api, client = api_of(fake, settings)
    with client:
        worker.work(api, settings, {"id": RUN_ID, "kind": "training"})

    assert {row[0] for row in fake.reports} == {PORCINI}
    assert fake.finished is not None
    assert fake.finished[0] == RunState.FINISHED.value


def test_work_fails_a_species_when_a_stage_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = chain(tmp_path, broken=True)
    settings = settings_for(tmp_path, monkeypatch, root)
    fake = Fake([{**species_row(PORCINI, "Boletus edulis"), "forecastEnabled": True}], [])
    api, client = api_of(fake, settings)
    with client:
        worker.work(api, settings, {"id": RUN_ID, "kind": "full"})

    assert (PORCINI, "failed", 4711) in fake.reports


def test_the_log_holds_the_output_of_the_stage(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = chain(tmp_path)
    settings = settings_for(tmp_path, monkeypatch, root)
    fake = Fake([{**species_row(PORCINI, "Boletus edulis"), "forecastEnabled": True}], [])
    api, client = api_of(fake, settings)
    with client:
        worker.work(api, settings, {"id": RUN_ID, "kind": "render"})

    log = (settings.run_logs / f"{RUN_ID}.log").read_text(encoding="utf-8")
    assert "NUR=boletus_edulis" in log


def test_work_reports_one_step_for_a_training_run(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = chain(tmp_path)
    settings = settings_for(tmp_path, monkeypatch, root)
    fake = Fake([{**species_row(PORCINI, "Boletus edulis"), "forecastEnabled": True}], [])
    api, client = api_of(fake, settings)
    with client:
        worker.work(api, settings, {"id": RUN_ID, "kind": "training"})

    assert (0, "run_all.sh", "running", None) in fake.steps
    finished = [row for row in fake.steps if row[0] == 0 and row[2] == "finished"]
    assert len(finished) == 1
    assert isinstance(finished[0][3], int)


def test_work_reports_two_steps_for_a_full_run(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = chain(tmp_path)
    settings = settings_for(tmp_path, monkeypatch, root)
    fake = Fake([{**species_row(PORCINI, "Boletus edulis"), "forecastEnabled": True}], [])
    api, client = api_of(fake, settings)
    with client:
        worker.work(api, settings, {"id": RUN_ID, "kind": "full"})

    names = {(position, name) for position, name, _, _ in fake.steps}
    assert names == {(0, "run_all.sh"), (1, "render_de.sh")}


def test_work_fails_the_step_when_a_species_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = chain(tmp_path)
    settings = settings_for(tmp_path, monkeypatch, root)
    fake = Fake(
        [{**species_row(GHOST, "Amanita phalloides"), "forecastEnabled": True}],
        [],
    )
    api, client = api_of(fake, settings)
    with client:
        worker.work(api, settings, {"id": RUN_ID, "kind": "training"})

    assert any(row[0] == 0 and row[2] == "failed" for row in fake.steps)


def test_finish_carries_the_calibrated_brier_score(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "modell"
    root.mkdir()
    script = (
        "#!/usr/bin/env bash\n"
        "if [ -n \"${LISTE:-}\" ]; then printf 'boletus_edulis\\tBoletus edulis\\n'; exit 0; fi\n"
        'echo "visits with weather: 10"\n'
        'echo "Brier score   raw 0.30000   calibrated 0.18000"\n'
    )
    (root / "run_all.sh").write_text(script, encoding="utf-8")
    settings = settings_for(tmp_path, monkeypatch, root)
    fake = Fake([{**species_row(PORCINI, "Boletus edulis"), "forecastEnabled": True}], [])
    api, client = api_of(fake, settings)
    with client:
        worker.work(api, settings, {"id": RUN_ID, "kind": "training"})

    assert fake.finished_metric == pytest.approx(0.18)


def test_finish_without_a_brier_line_carries_no_metric(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = chain(tmp_path)
    settings = settings_for(tmp_path, monkeypatch, root)
    fake = Fake([{**species_row(PORCINI, "Boletus edulis"), "forecastEnabled": True}], [])
    api, client = api_of(fake, settings)
    with client:
        worker.work(api, settings, {"id": RUN_ID, "kind": "training"})

    assert fake.finished_metric is None


def test_species_reads_every_page(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    pages = [
        {
            "items": [{**species_row(PORCINI, "Boletus edulis"), "forecastEnabled": True}],
            "nextCursor": "MQ",
        },
        {
            "items": [{**species_row(GHOST, "Amanita phalloides"), "forecastEnabled": True}],
            "nextCursor": None,
        },
    ]

    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=pages[1 if request.url.params.get("cursor") else 0])

    settings = settings_for(tmp_path, monkeypatch, chain(tmp_path))
    client = httpx.Client(transport=httpx.MockTransport(handle), base_url="http://test/api")
    with client:
        found = worker.Api(settings, client).species()
    assert [row["id"] for row in found] == [PORCINI, GHOST]


def test_main_works_a_claimed_run(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    settings_for(tmp_path, monkeypatch, chain(tmp_path))
    fake = Fake([{**species_row(PORCINI, "Boletus edulis"), "forecastEnabled": True}], [])
    patch_client(monkeypatch, fake)
    assert worker.main([]) == 0
    assert fake.finished is not None


def test_main_is_quiet_without_a_run(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    settings_for(tmp_path, monkeypatch, chain(tmp_path))
    fake = Fake([], [])
    fake.claimed = False
    patch_client(monkeypatch, fake)
    assert worker.main([]) == 0
    assert fake.finished is None

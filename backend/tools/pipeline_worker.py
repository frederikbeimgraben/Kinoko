"""Der Arbeiter der Kette: nimmt einen Lauf, startet die Stufen, meldet den Stand."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from statistics import mean
from typing import TYPE_CHECKING, Any, Final

import httpx

from app.core.settings import Settings, get_settings
from app.shared.enums import RunKind, RunState

if TYPE_CHECKING:
    from collections.abc import Sequence
    from typing import TextIO

STAGES: Final[dict[RunKind, tuple[str, ...]]] = {
    RunKind.TRAINING: ("run_all.sh",),
    RunKind.RENDER: ("render_de.sh",),
    RunKind.FULL: ("run_all.sh", "render_de.sh"),
}
LIST_SCRIPT: Final = "run_all.sh"
FINDS_FILE: Final = Path("data/raw/app/finds.json")
RECORDS: Final = re.compile(r"^visits with weather:\s*(\d+)", re.MULTILINE)
BRIER: Final = re.compile(r"^Brier score\s+raw\s+[\d.]+\s+calibrated\s+([\d.]+)", re.MULTILINE)
PAGE_SIZE: Final = 40
TIMEOUT: Final = 60.0
OK: Final = 200


def shell() -> str:
    """Der Pfad zur Bash, mit der die Stufen laufen."""
    return shutil.which("bash") or "/bin/sh"


def records_in(text: str) -> int:
    """Die Zahl der Datensätze aus der Ausgabe einer Stufe."""
    found = RECORDS.findall(text)
    return int(found[-1]) if found else 0


def brier_in(text: str) -> float | None:
    """Der kalibrierte Brier-Wert aus der Ausgabe einer Stufe."""
    found = BRIER.findall(text)
    return float(found[-1]) if found else None


def chain_names(root: Path) -> dict[str, str]:
    """Der Name der Kette je lateinischem Namen."""
    done = subprocess.run(  # noqa: S603
        [shell(), str(root / LIST_SCRIPT)],
        cwd=root,
        env={**os.environ, "LISTE": "1"},
        capture_output=True,
        text=True,
        check=False,
    )
    found: dict[str, str] = {}
    for line in done.stdout.splitlines():
        name, _, taxa = line.partition("\t")
        for latin in taxa.split(","):
            if latin.strip():
                found[latin.strip().lower()] = name
    return found


def stage(root: Path, script: str, name: str, log: TextIO) -> tuple[bool, str]:
    """Startet eine Stufe für eine Art und schreibt ihre Ausgabe ins Protokoll."""
    done = subprocess.run(  # noqa: S603
        [shell(), str(root / script)],
        cwd=root,
        env={**os.environ, "NUR": name},
        capture_output=True,
        text=True,
        check=False,
    )
    log.write(done.stdout)
    log.write(done.stderr)
    log.flush()
    return done.returncode == 0, done.stdout


def write_finds(
    root: Path,
    finds: list[dict[str, Any]],
    names: dict[str, str],
) -> Path:
    """Schreibt die Trainingsfunde in die Datei, die die Kette liest."""
    target = root / FINDS_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    items = [
        {**find, "scientificName": names[find["speciesId"]]}
        for find in finds
        if find["speciesId"] in names
    ]
    target.write_text(json.dumps({"items": items}), encoding="utf-8")
    return target


class Api:
    """Der Zugang zu den Endpunkten, die der Arbeiter braucht."""

    def __init__(self, settings: Settings, client: httpx.Client) -> None:
        self.client = client
        self.headers = {"X-Internal-Token": settings.internal_token}

    def claim(self) -> dict[str, Any] | None:
        """Nimmt den ältesten wartenden Lauf."""
        answer = self.client.post("/internal/pipeline-runs/claim", headers=self.headers)
        answer.raise_for_status()
        return dict(answer.json()) if answer.status_code == OK else None

    def species(self) -> list[dict[str, Any]]:
        """Die Arten mit Vorhersage, über alle Seiten."""
        found: list[dict[str, Any]] = []
        cursor: str | None = None
        while True:
            params: dict[str, Any] = {"limit": PAGE_SIZE}
            if cursor:
                params["cursor"] = cursor
            answer = self.client.get("/species", params=params)
            answer.raise_for_status()
            body = answer.json()
            found += [row for row in body["items"] if row["forecastEnabled"]]
            cursor = body.get("nextCursor")
            if not cursor:
                return found

    def training_finds(self) -> list[dict[str, Any]]:
        """Die Funde, die für das Training freigegeben sind."""
        answer = self.client.get("/internal/training-finds", headers=self.headers)
        answer.raise_for_status()
        return list(answer.json()["items"])

    def report(self, run_id: str, species_id: str, state: RunState, records: int) -> None:
        """Meldet den Stand einer Art."""
        answer = self.client.post(
            f"/internal/pipeline-runs/{run_id}/species/{species_id}",
            json={"state": state.value, "recordCount": records},
            headers=self.headers,
        )
        answer.raise_for_status()

    def report_step(
        self,
        run_id: str,
        position: int,
        name: str,
        state: RunState,
        duration_s: int | None,
    ) -> None:
        """Meldet den Stand einer Stufe."""
        answer = self.client.put(
            f"/internal/pipeline-runs/{run_id}/steps/{position}",
            json={"name": name, "state": state.value, "durationS": duration_s},
            headers=self.headers,
        )
        answer.raise_for_status()

    def finish(
        self,
        run_id: str,
        state: RunState,
        log_path: str,
        metric_brier: float | None,
    ) -> None:
        """Schließt einen Lauf ab."""
        answer = self.client.post(
            f"/internal/pipeline-runs/{run_id}/finish",
            json={"state": state.value, "logPath": log_path, "metricBrier": metric_brier},
            headers=self.headers,
        )
        answer.raise_for_status()


@dataclass(frozen=True, slots=True)
class Job:
    """Was eine Stufe eines Laufs zum Rechnen braucht."""

    api: Api
    root: Path
    run: dict[str, Any]
    names: dict[str, str]
    log: TextIO
    briers: list[float] = field(default_factory=list)


def run_species(job: Job, script: str, row: dict[str, Any]) -> tuple[bool, int]:
    """Startet eine Stufe für eine Art und meldet ihren Stand."""
    job.api.report(job.run["id"], row["id"], RunState.RUNNING, 0)
    name = job.names.get(row["scientificName"].lower())
    if name is None:
        job.api.report(job.run["id"], row["id"], RunState.FAILED, 0)
        return False, 0
    done, text = stage(job.root, script, name, job.log)
    records = records_in(text)
    brier = brier_in(text)
    if brier is not None:
        job.briers.append(brier)
    state = RunState.FINISHED if done else RunState.FAILED
    job.api.report(job.run["id"], row["id"], state, records)
    return done, records


def run_stage(
    job: Job,
    position: int,
    script: str,
    species: list[dict[str, Any]],
    failed: set[str],
) -> None:
    """Startet eine Stufe für jede noch offene Art und meldet Stand und Dauer."""
    job.api.report_step(job.run["id"], position, script, RunState.RUNNING, None)
    start = time.monotonic()
    ok = True
    for row in species:
        if row["id"] in failed:
            continue
        done, _ = run_species(job, script, row)
        if not done:
            ok = False
            failed.add(row["id"])
    duration = round(time.monotonic() - start)
    job.api.report_step(
        job.run["id"],
        position,
        script,
        RunState.FINISHED if ok else RunState.FAILED,
        duration,
    )


def work(api: Api, settings: Settings, run: dict[str, Any]) -> int:
    """Arbeitet einen Lauf ab: Eingang schreiben, Stufen starten, abschließen."""
    root = settings.chain
    species = api.species()
    names = chain_names(root)
    write_finds(root, api.training_finds(), {row["id"]: row["scientificName"] for row in species})
    log_path = settings.run_logs / f"{run['id']}.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    failed: set[str] = set()
    with log_path.open("w", encoding="utf-8") as log:
        job = Job(api=api, root=root, run=run, names=names, log=log)
        for position, script in enumerate(STAGES[RunKind(run["kind"])]):
            run_stage(job, position, script, species, failed)
    metric_brier = mean(job.briers) if job.briers else None
    state = RunState.FAILED if failed else RunState.FINISHED
    api.finish(run["id"], state, str(log_path), metric_brier)
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    """Nimmt einen Lauf, wenn einer wartet, und arbeitet ihn ab."""
    del argv
    settings = get_settings()
    with httpx.Client(base_url=settings.api, timeout=TIMEOUT) as client:
        api = Api(settings, client)
        run = api.claim()
        if run is None:
            print("kein wartender Lauf")
            return 0
        return work(api, settings, run)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

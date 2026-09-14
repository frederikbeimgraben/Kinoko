"""Der Arbeiter der Kette: nimmt einen Lauf, startet die Stufen, meldet den Stand."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, Final

import httpx

from app.core.settings import Settings, get_settings
from app.shared.enums import RunKind, RunState

if TYPE_CHECKING:
    from collections.abc import Iterable, Sequence
    from typing import TextIO

STAGES: Final[dict[RunKind, tuple[str, ...]]] = {
    RunKind.TRAINING: ("run_all.sh",),
    RunKind.RENDER: ("render_de.sh",),
    RunKind.FULL: ("run_all.sh", "render_de.sh"),
}
LIST_SCRIPT: Final = "run_all.sh"
FINDS_FILE: Final = Path("data/raw/app/finds.json")
RECORDS: Final = re.compile(r"^visits with weather:\s*(\d+)", re.MULTILINE)
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


def write_finds(root: Path, finds: Iterable[dict[str, Any]], names: dict[str, str]) -> Path:
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

    def finish(self, run_id: str, state: RunState, log_path: str) -> None:
        """Schließt einen Lauf ab."""
        answer = self.client.post(
            f"/internal/pipeline-runs/{run_id}/finish",
            json={"state": state.value, "logPath": log_path},
            headers=self.headers,
        )
        answer.raise_for_status()


@dataclass(frozen=True, slots=True)
class Job:
    """Was eine Art eines Laufs zum Rechnen braucht."""

    api: Api
    root: Path
    run: dict[str, Any]
    names: dict[str, str]
    log: TextIO


def one_species(job: Job, row: dict[str, Any]) -> bool:
    """Rechnet eine Art und meldet ihren Stand vorher und nachher."""
    job.api.report(job.run["id"], row["id"], RunState.RUNNING, 0)
    name = job.names.get(row["scientificName"].lower())
    if name is None:
        job.api.report(job.run["id"], row["id"], RunState.FAILED, 0)
        return False
    records = 0
    done = True
    for script in STAGES[RunKind(job.run["kind"])]:
        done, text = stage(job.root, script, name, job.log)
        records = max(records, records_in(text))
        if not done:
            break
    state = RunState.FINISHED if done else RunState.FAILED
    job.api.report(job.run["id"], row["id"], state, records)
    return done


def work(api: Api, settings: Settings, run: dict[str, Any]) -> int:
    """Arbeitet einen Lauf ab: Eingang schreiben, Stufen starten, abschließen."""
    root = settings.chain
    species = api.species()
    names = chain_names(root)
    write_finds(root, api.training_finds(), {row["id"]: row["scientificName"] for row in species})
    log_path = settings.run_logs / f"{run['id']}.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("w", encoding="utf-8") as log:
        job = Job(api=api, root=root, run=run, names=names, log=log)
        broken = sum(not one_species(job, row) for row in species)
    api.finish(run["id"], RunState.FAILED if broken else RunState.FINISHED, str(log_path))
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

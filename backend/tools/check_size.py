"""Prüft Dateigrößen in ``app/modules``, ``app/core`` und ``app/shared``."""

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Final, cast

ROOT: Final = Path(__file__).resolve().parent.parent
ALLOW_PATH: Final = Path(__file__).resolve().parent / "lint-allow.json"

LIMITS: Final[dict[str, int]] = {"modules": 250, "core": 300, "shared": 300}


@dataclass(frozen=True, slots=True)
class Violation:
    """Eine Datei über ihrer Grenze."""

    path: str
    lines: int
    limit: int

    @property
    def key(self) -> str:
        """Schlüssel für die Ausnahmeliste: der Pfad."""
        return self.path


def is_test_file(path: Path) -> bool:
    """Erkennt Testdateien, die die Grössenprüfung ausnimmt."""
    return path.name.startswith("test_") or path.name.endswith("_test.py")


def zone_of(rel: Path) -> str | None:
    """Erste Ebene unter ``app``, sofern eine Grenze dafür gilt."""
    first = rel.parts[0]
    return first if first in LIMITS else None


def collect_files() -> list[Path]:
    """Listet die .py-Dateien unter den drei geprüften Ordnern."""
    files: list[Path] = []
    for zone in LIMITS:
        files.extend((ROOT / "app" / zone).rglob("*.py"))
    return sorted(files)


def all_violations() -> list[Violation]:
    """Zählt Zeilen je Datei und meldet, was über der Grenze liegt."""
    found: list[Violation] = []
    for file in collect_files():
        if is_test_file(file):
            continue
        zone = zone_of(file.relative_to(ROOT / "app"))
        if zone is None:
            continue
        limit = LIMITS[zone]
        lines = file.read_text(encoding="utf-8").count("\n") + 1
        if lines > limit:
            found.append(Violation(file.relative_to(ROOT).as_posix(), lines, limit))
    return found


def read_allow() -> dict[str, list[str]]:
    """Liest die Ausnahmeliste, leer wenn die Datei fehlt."""
    try:
        raw = ALLOW_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    return cast("dict[str, list[str]]", json.loads(raw))


def write_allow(key: str, keys: list[str]) -> None:
    """Schreibt die Ausnahmeliste neu, andere Schlüssel bleiben stehen."""
    allow = read_allow()
    allow[key] = keys
    ALLOW_PATH.write_text(json.dumps(allow, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    """Prüft, meldet neue Verstöße oder schreibt die Ausnahmeliste neu."""
    violations = all_violations()
    keys = sorted({v.key for v in violations})
    if "--write-allow" in sys.argv:
        write_allow("size", keys)
        print(f"{len(keys)} Ausnahmen für size geschrieben.")
        return
    allowed = set(read_allow().get("size", []))
    reported = [v for v in violations if v.key not in allowed]
    for v in reported:
        print(f"{v.path}:{v.lines}  size  {v.lines} Zeilen, Grenze {v.limit}")
    if reported:
        print(f"Neue Größenverstöße: {len(reported)}.")
        raise SystemExit(1)
    print("Keine neuen Größenverstöße.")


if __name__ == "__main__":
    main()

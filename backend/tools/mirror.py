"""Spiegelt eine Vorgabe aus ``artefakte`` in das Backend."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def source(name: str, root: Path = ROOT) -> Path | None:
    """Sucht ``artefakte/<name>`` von ``root`` aufwärts."""
    for folder in [root, *root.parents]:
        hit = folder / "artefakte" / name
        if hit.is_file():
            return hit
    return None


def sync(found: Path | None, target: Path) -> int:
    """Kopiert die Vorgabe nach ``target``. Ohne Vorgabe bleibt die Kopie."""
    if found is None:
        if not target.is_file():
            print(f"weder eine Vorgabe in artefakte noch {target.name}")
            return 1
        print(f"kein Artefakt gefunden, {target.name} bleibt")
        return 0
    if target.is_file() and target.read_bytes() == found.read_bytes():
        print(f"{target.name} ist auf dem Stand von {found}")
        return 0
    shutil.copyfile(found, target)
    print(f"{target.name} aus {found} erneuert")
    return 0

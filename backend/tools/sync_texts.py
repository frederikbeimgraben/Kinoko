"""Spiegelt ``artefakte/texte.json`` nach ``backend/daten/texte.json``."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "daten" / "texte.json"


def source() -> Path | None:
    """Sucht ``artefakte/texte.json`` von hier aufwärts."""
    for folder in [ROOT, *ROOT.parents]:
        hit = folder / "artefakte" / "texte.json"
        if hit.is_file():
            return hit
    return None


def main() -> int:
    """Kopiert die Vorgabe. Ohne Artefakt bleibt die eingecheckte Kopie."""
    found = source()
    if found is None:
        if not TARGET.is_file():
            print("weder artefakte/texte.json noch daten/texte.json")
            return 1
        print(f"kein Artefakt gefunden, {TARGET.name} bleibt")
        return 0
    if TARGET.is_file() and TARGET.read_bytes() == found.read_bytes():
        print(f"{TARGET.name} ist auf dem Stand von {found}")
        return 0
    shutil.copyfile(found, TARGET)
    print(f"{TARGET.name} aus {found} erneuert")
    return 0


if __name__ == "__main__":
    sys.exit(main())

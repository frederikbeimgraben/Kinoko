"""Spiegelt ``artefakte/texte.json`` nach ``backend/daten/texte.json``."""

from __future__ import annotations

import sys
from typing import Final

from tools import mirror

NAME: Final = "texte.json"
TARGET: Final = mirror.ROOT / "daten" / NAME


def main() -> int:
    """Kopiert die Texte über die Standardpfade."""
    return mirror.sync(mirror.source(NAME), TARGET)


if __name__ == "__main__":
    sys.exit(main())

"""Spiegelt ``artefakte/openapi.yaml`` nach ``backend/openapi.yaml``."""

from __future__ import annotations

import sys
from typing import Final

from tools import mirror

NAME: Final = "openapi.yaml"
TARGET: Final = mirror.ROOT / NAME


def main() -> int:
    """Kopiert den Vertrag über die Standardpfade."""
    return mirror.sync(mirror.source(NAME), TARGET)


if __name__ == "__main__":
    sys.exit(main())

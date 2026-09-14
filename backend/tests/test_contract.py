"""Jeder Pfad des Vertrags hat eine Route im Backend."""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

from app.main import build_app

CONTRACT = Path(__file__).resolve().parent.parent / "openapi.yaml"
PARAMETER = re.compile(r"\{[^}]+\}")


def template(path: str) -> str:
    """Ersetzt jeden Pfadparameter durch ein Zeichen."""
    return PARAMETER.sub("{}", path)


def contract_paths() -> set[str]:
    """Liest die Pfade des Vertrags, mit dem Präfix des Servers."""
    data = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    return {template(f"/api{path}") for path in data["paths"]}


def service_paths() -> set[str]:
    """Liest die Pfade der App aus ihrem eigenen Schema."""
    return {template(path) for path in build_app().openapi()["paths"]}


@pytest.mark.contract
def test_every_contract_path_has_a_route() -> None:
    missing = sorted(contract_paths() - service_paths())
    assert not missing, f"{len(missing)} Pfade ohne Route: {missing}"

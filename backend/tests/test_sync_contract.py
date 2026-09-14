from pathlib import Path

import pytest

from tools import sync_contract


def test_the_source_is_the_artefact() -> None:
    found = sync_contract.source()
    assert found is None or found.name == "openapi.yaml"


def test_the_copy_runs(capsys: pytest.CaptureFixture[str]) -> None:
    assert sync_contract.main() == 0
    assert "openapi.yaml" in capsys.readouterr().out


def test_without_source_and_without_copy_it_fails(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(sync_contract, "source", lambda: None)
    monkeypatch.setattr(sync_contract, "TARGET", tmp_path / "openapi.yaml")
    assert sync_contract.main() == 1


def test_without_source_the_copy_stays(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    target = tmp_path / "openapi.yaml"
    target.write_text("openapi: 3.1.0\n", encoding="utf-8")
    monkeypatch.setattr(sync_contract, "source", lambda: None)
    monkeypatch.setattr(sync_contract, "TARGET", target)
    assert sync_contract.main() == 0
    assert "bleibt" in capsys.readouterr().out


def test_a_different_source_is_copied(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    origin = tmp_path / "origin.yaml"
    origin.write_text("openapi: 3.1.0\n", encoding="utf-8")
    target = tmp_path / "openapi.yaml"
    monkeypatch.setattr(sync_contract, "source", lambda: origin)
    monkeypatch.setattr(sync_contract, "TARGET", target)
    assert sync_contract.main() == 0
    assert target.read_text(encoding="utf-8") == "openapi: 3.1.0\n"

"""Die Werkzeuge des Backends."""

import json
from pathlib import Path

import pytest

from tools import check_comments, check_size, mirror, sync_contract, sync_texts

GOOD = '''"""Ein Modul."""


def a() -> None:
    """Tut nichts."""
'''

BAD_YEAR = '''"""Ein Modul."""

# Stand 2026-09-14
'''

BAD_BLOCK = '''"""Ein Modul."""

# eins
# zwei
# drei
'''

BAD_DOC = '''"""Eins
Zwei
Drei
Vier
"""
'''


def test_forbidden_reason() -> None:
    assert check_comments.forbidden_reason(" Stand 2026") == "Jahreszahl oder Datum im Kommentar"
    assert check_comments.forbidden_reason(" siehe PR 12") == "PR-Nummer im Kommentar"
    assert check_comments.forbidden_reason(" gilt seit gestern")
    assert check_comments.forbidden_reason(" alles gut") is None


@pytest.mark.parametrize(
    ("source", "count"),
    [(GOOD, 0), (BAD_YEAR, 1), (BAD_BLOCK, 1), (BAD_DOC, 1)],
)
def test_group_violations(source: str, count: int) -> None:
    found = check_comments.scan_source(source)
    assert len(check_comments.group_violations("x.py", found)) == count


def test_violation_key_is_stable() -> None:
    one = check_comments.Violation("x.py", 1, "inhalt", "a", "b")
    two = check_comments.Violation("x.py", 9, "inhalt", "a", "c")
    assert one.key == two.key


def test_read_allow_without_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(check_comments, "ALLOW_PATH", tmp_path / "fehlt.json")
    assert check_comments.read_allow() == {}


def test_write_allow(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    file = tmp_path / "allow.json"
    monkeypatch.setattr(check_comments, "ALLOW_PATH", file)
    check_comments.write_allow("comments", ["a"])
    assert json.loads(file.read_text(encoding="utf-8")) == {"comments": ["a"]}


def test_check_comments_main_is_quiet(capsys: pytest.CaptureFixture[str]) -> None:
    check_comments.main()
    assert "Keine neuen" in capsys.readouterr().out


def test_check_comments_main_writes_the_allow_list(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(check_comments, "ALLOW_PATH", tmp_path / "allow.json")
    monkeypatch.setattr(check_comments.sys, "argv", ["x", "--write-allow"])
    check_comments.main()
    assert "Ausnahmen" in capsys.readouterr().out


def test_is_test_file() -> None:
    assert check_size.is_test_file(Path("test_a.py"))
    assert check_size.is_test_file(Path("a_test.py"))
    assert not check_size.is_test_file(Path("a.py"))


def test_zone_of() -> None:
    assert check_size.zone_of(Path("modules/a.py")) == "modules"
    assert check_size.zone_of(Path("anderes/a.py")) is None


def test_check_size_finds_no_violation() -> None:
    assert check_size.all_violations() == []


def test_check_size_main_is_quiet(capsys: pytest.CaptureFixture[str]) -> None:
    check_size.main()
    assert "Keine neuen" in capsys.readouterr().out


def test_check_size_main_writes_the_allow_list(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(check_size, "ALLOW_PATH", tmp_path / "allow.json")
    monkeypatch.setattr(check_size.sys, "argv", ["x", "--write-allow"])
    check_size.main()
    assert "Ausnahmen" in capsys.readouterr().out


def test_violation_key_of_size() -> None:
    assert check_size.Violation("a.py", 300, 250).key == "a.py"


def test_the_sync_tools_point_at_the_checked_in_copies() -> None:
    assert sync_contract.TARGET.name == "openapi.yaml"
    assert sync_texts.TARGET.parent.name == "daten"


def test_sync_keeps_an_equal_copy(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    found = tmp_path / "texte.json"
    found.write_text("{}", encoding="utf-8")
    target = tmp_path / "daten" / "texte.json"
    target.parent.mkdir()
    target.write_text("{}", encoding="utf-8")
    assert mirror.sync(found, target) == 0
    assert "auf dem Stand" in capsys.readouterr().out


def test_sync_copies_a_changed_file(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    found = tmp_path / "texte.json"
    found.write_text('{"de": {}}', encoding="utf-8")
    target = tmp_path / "daten" / "texte.json"
    target.parent.mkdir()
    assert mirror.sync(found, target) == 0
    assert "erneuert" in capsys.readouterr().out
    assert target.read_text(encoding="utf-8") == '{"de": {}}'


def test_sync_without_source_and_without_target(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert mirror.sync(None, tmp_path / "openapi.yaml") == 1
    assert "weder" in capsys.readouterr().out


def test_sync_without_source_keeps_the_copy(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    target = tmp_path / "openapi.yaml"
    target.write_text("x", encoding="utf-8")
    assert mirror.sync(None, target) == 0
    assert "bleibt" in capsys.readouterr().out
    assert target.read_text(encoding="utf-8") == "x"


def test_source_finds_the_artefact_upwards(tmp_path: Path) -> None:
    wanted = tmp_path / "artefakte" / "texte.json"
    wanted.parent.mkdir()
    wanted.write_text("{}", encoding="utf-8")
    deep = tmp_path / "app" / "backend"
    deep.mkdir(parents=True)
    assert mirror.source("texte.json", deep) == wanted


def test_source_without_an_artefact_is_none(tmp_path: Path) -> None:
    assert mirror.source("nichts.json", tmp_path) is None

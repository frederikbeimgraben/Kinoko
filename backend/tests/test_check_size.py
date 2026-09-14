"""Prüft die Dateigrößen je Zone und die Ausnahme für Tests."""

import json
from pathlib import Path

import pytest

from tools import check_size
from tools.check_size import Violation


def write_module(root: Path, rel: str, text: str) -> Path:
    target = root / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    return target


def lines_of(count: int) -> str:
    return "\n".join(f"x{i}" for i in range(count))


def test_the_violation_key_is_its_path() -> None:
    violation = Violation(path="app/modules/x.py", lines=300, limit=250)

    assert violation.key == "app/modules/x.py"


def test_is_test_file_recognises_the_test_prefix() -> None:
    assert check_size.is_test_file(Path("test_widget.py")) is True


def test_is_test_file_recognises_the_test_suffix() -> None:
    assert check_size.is_test_file(Path("widget_test.py")) is True


def test_is_test_file_rejects_a_plain_module() -> None:
    assert check_size.is_test_file(Path("widget.py")) is False


def test_zone_of_recognises_each_known_zone() -> None:
    assert check_size.zone_of(Path("modules/x.py")) == "modules"
    assert check_size.zone_of(Path("core/x.py")) == "core"
    assert check_size.zone_of(Path("shared/x.py")) == "shared"


def test_zone_of_returns_none_outside_the_known_zones() -> None:
    assert check_size.zone_of(Path("other/x.py")) is None


def test_collect_files_lists_python_files_under_every_zone(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(check_size, "ROOT", tmp_path)
    write_module(tmp_path, "app/modules/a.py", "x = 1\n")
    write_module(tmp_path, "app/core/b.py", "x = 1\n")
    write_module(tmp_path, "app/shared/c.py", "x = 1\n")
    write_module(tmp_path, "app/other/d.py", "x = 1\n")

    files = check_size.collect_files()

    assert files == [
        tmp_path / "app" / "core" / "b.py",
        tmp_path / "app" / "modules" / "a.py",
        tmp_path / "app" / "shared" / "c.py",
    ]


def test_a_file_over_the_limit_of_its_zone_is_reported(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(check_size, "ROOT", tmp_path)
    write_module(tmp_path, "app/modules/gross.py", lines_of(251))

    violations = check_size.all_violations()

    assert len(violations) == 1
    assert violations[0].limit == 250
    assert violations[0].lines == 251


def test_a_file_at_the_limit_is_not_reported(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(check_size, "ROOT", tmp_path)
    write_module(tmp_path, "app/modules/genau.py", lines_of(250))

    assert check_size.all_violations() == []


def test_core_and_shared_allow_more_lines_than_modules(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(check_size, "ROOT", tmp_path)
    write_module(tmp_path, "app/core/gross.py", lines_of(301))
    write_module(tmp_path, "app/shared/gross.py", lines_of(301))

    violations = check_size.all_violations()

    assert len(violations) == 2
    assert {v.limit for v in violations} == {300}


def test_a_test_file_over_the_limit_is_exempt(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(check_size, "ROOT", tmp_path)
    write_module(tmp_path, "app/modules/test_gross.py", lines_of(400))

    assert check_size.all_violations() == []


def test_a_file_outside_the_known_zones_is_skipped(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(check_size, "ROOT", tmp_path)
    outside = tmp_path / "app" / "other" / "z.py"
    monkeypatch.setattr(check_size, "collect_files", lambda: [outside])

    assert check_size.all_violations() == []


def test_read_allow_is_empty_without_a_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(check_size, "ALLOW_PATH", tmp_path / "lint-allow.json")

    assert check_size.read_allow() == {}


def test_read_allow_reads_existing_entries(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    allow_path = tmp_path / "lint-allow.json"
    allow_path.write_text(json.dumps({"size": ["a.py"]}), encoding="utf-8")
    monkeypatch.setattr(check_size, "ALLOW_PATH", allow_path)

    assert check_size.read_allow() == {"size": ["a.py"]}


def test_write_allow_keeps_other_keys(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    allow_path = tmp_path / "lint-allow.json"
    allow_path.write_text(json.dumps({"comments": ["b.py:1"]}), encoding="utf-8")
    monkeypatch.setattr(check_size, "ALLOW_PATH", allow_path)

    check_size.write_allow("size", ["a.py"])

    written = json.loads(allow_path.read_text(encoding="utf-8"))
    assert written == {"comments": ["b.py:1"], "size": ["a.py"]}


def test_main_write_allow_writes_the_current_violations(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(check_size, "ROOT", tmp_path)
    allow_path = tmp_path / "lint-allow.json"
    monkeypatch.setattr(check_size, "ALLOW_PATH", allow_path)
    write_module(tmp_path, "app/modules/gross.py", lines_of(251))
    monkeypatch.setattr("sys.argv", ["check_size", "--write-allow"])

    check_size.main()

    written = json.loads(allow_path.read_text(encoding="utf-8"))
    assert written["size"] == ["app/modules/gross.py"]
    assert "1 Ausnahmen für size geschrieben." in capsys.readouterr().out


def test_main_reports_a_violation_and_exits_with_1(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(check_size, "ROOT", tmp_path)
    monkeypatch.setattr(check_size, "ALLOW_PATH", tmp_path / "lint-allow.json")
    write_module(tmp_path, "app/modules/gross.py", lines_of(251))
    monkeypatch.setattr("sys.argv", ["check_size"])

    with pytest.raises(SystemExit) as ended:
        check_size.main()

    assert ended.value.code == 1
    printed = capsys.readouterr().out
    assert "app/modules/gross.py:251  size  251 Zeilen, Grenze 250" in printed
    assert "Neue Größenverstöße: 1." in printed


def test_main_skips_an_allowed_violation_and_exits_cleanly(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(check_size, "ROOT", tmp_path)
    allow_path = tmp_path / "lint-allow.json"
    allow_path.write_text(json.dumps({"size": ["app/modules/gross.py"]}), encoding="utf-8")
    monkeypatch.setattr(check_size, "ALLOW_PATH", allow_path)
    write_module(tmp_path, "app/modules/gross.py", lines_of(251))
    monkeypatch.setattr("sys.argv", ["check_size"])

    check_size.main()

    assert "Keine neuen Größenverstöße." in capsys.readouterr().out


def test_main_ignores_a_stale_allow_entry(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(check_size, "ROOT", tmp_path)
    allow_path = tmp_path / "lint-allow.json"
    allow_path.write_text(json.dumps({"size": ["app/modules/nichtmehr.py"]}), encoding="utf-8")
    monkeypatch.setattr(check_size, "ALLOW_PATH", allow_path)
    write_module(tmp_path, "app/modules/klein.py", "x = 1\n")
    monkeypatch.setattr("sys.argv", ["check_size"])

    check_size.main()

    assert "Keine neuen Größenverstöße." in capsys.readouterr().out

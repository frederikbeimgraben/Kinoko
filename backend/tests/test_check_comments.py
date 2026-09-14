"""Prüft die Kommentarregeln: Blocklänge, Docstring-Länge, verbotener Inhalt."""

import json
from pathlib import Path

import pytest

from tools import check_comments
from tools.check_comments import RawComment, Violation


def write_module(root: Path, rel: str, text: str) -> Path:
    target = root / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    return target


def a_line(start: int, *, standalone: bool) -> RawComment:
    return RawComment(kind="line", start=start, end=start, text="x", standalone=standalone)


def a_doc(start: int, end: int) -> RawComment:
    return RawComment(kind="doc", start=start, end=end, text="x", standalone=True)


def test_a_year_in_the_text_is_reported() -> None:
    reason = check_comments.forbidden_reason("Stand 2026")
    assert reason == "Jahreszahl oder Datum im Kommentar"


def test_a_date_in_the_text_is_reported() -> None:
    reason = check_comments.forbidden_reason("Gebaut am 2026-09-14")
    assert reason == "Jahreszahl oder Datum im Kommentar"


def test_a_pr_number_with_a_hash_is_reported() -> None:
    assert check_comments.forbidden_reason("siehe #42 dazu") == "PR-Nummer im Kommentar"


def test_a_pr_number_written_as_pr_is_reported() -> None:
    assert check_comments.forbidden_reason("siehe PR 42") == "PR-Nummer im Kommentar"


@pytest.mark.parametrize("word", ["bis", "frueher", "früher", "jetzt", "seit"])
def test_a_forbidden_word_is_reported(word: str) -> None:
    reason = check_comments.forbidden_reason(f"Das war {word} so.")
    assert reason == f"verbotenes Wort „{word}“"


def test_a_clean_text_has_no_reason() -> None:
    assert check_comments.forbidden_reason("Ein gewöhnlicher Kommentar.") is None


def test_scan_source_finds_a_standalone_comment() -> None:
    found = check_comments.scan_source("def f() -> None:\n    # allein\n    return None\n")

    assert len(found) == 1
    assert found[0].kind == "line"
    assert found[0].standalone is True
    assert found[0].text == " allein"


def test_scan_source_finds_a_trailing_comment() -> None:
    found = check_comments.scan_source("x = 1  # dahinter\n")

    assert found[0].standalone is False


def test_scan_source_finds_a_double_quoted_docstring() -> None:
    found = check_comments.scan_source('"""Kurz."""\n')

    assert found[0].kind == "doc"
    assert found[0].text == "Kurz."
    assert found[0].standalone is True


def test_scan_source_finds_a_single_quoted_docstring() -> None:
    found = check_comments.scan_source("'''Kurz.'''\n")

    assert found[0].kind == "doc"


def test_scan_source_ignores_a_plain_string() -> None:
    assert check_comments.scan_source('x = "hallo"\n') == []


def test_standalone_runs_groups_consecutive_lines() -> None:
    runs = check_comments.standalone_runs(
        [a_doc(1, 1), a_line(2, standalone=True), a_line(3, standalone=True)],
    )

    assert [[c.start for c in run] for run in runs] == [[2, 3]]


def test_standalone_runs_breaks_on_a_trailing_comment() -> None:
    runs = check_comments.standalone_runs(
        [a_line(2, standalone=True), a_line(3, standalone=True), a_line(4, standalone=False)],
    )

    assert [[c.start for c in run] for run in runs] == [[2, 3]]


def test_standalone_runs_breaks_on_a_gap() -> None:
    runs = check_comments.standalone_runs(
        [a_line(10, standalone=True), a_line(20, standalone=True)],
    )

    assert [[c.start for c in run] for run in runs] == [[10], [20]]


def test_standalone_runs_keeps_an_open_run_at_the_end() -> None:
    runs = check_comments.standalone_runs([a_line(1, standalone=True), a_line(2, standalone=True)])

    assert [[c.start for c in run] for run in runs] == [[1, 2]]


def test_run_violations_reports_a_run_over_the_limit() -> None:
    violations = check_comments.run_violations(
        "a.py",
        [[a_line(1, standalone=True), a_line(2, standalone=True), a_line(3, standalone=True)]],
    )

    assert len(violations) == 1
    assert violations[0].rule == "block"
    assert violations[0].line == 1


def test_run_violations_allows_a_run_at_the_limit() -> None:
    run = [a_line(1, standalone=True), a_line(2, standalone=True)]
    assert check_comments.run_violations("a.py", [run]) == []


def test_content_violation_reports_forbidden_content() -> None:
    comment = RawComment(kind="line", start=5, end=5, text=" seit langem kaputt", standalone=True)

    violation = check_comments.content_violation("a.py", comment)

    assert violation is not None
    assert violation.rule == "inhalt"


def test_content_violation_reports_a_long_docstring() -> None:
    comment = RawComment(kind="doc", start=1, end=4, text="A\nB\nC\nD", standalone=True)

    violation = check_comments.content_violation("a.py", comment)

    assert violation is not None
    assert violation.rule == "docstring"


def test_content_violation_allows_a_docstring_at_the_limit() -> None:
    comment = RawComment(kind="doc", start=1, end=3, text="A\nB\nC", standalone=True)

    assert check_comments.content_violation("a.py", comment) is None


def test_content_violation_allows_a_clean_line_comment() -> None:
    comment = RawComment(kind="line", start=1, end=1, text=" harmlos", standalone=True)

    assert check_comments.content_violation("a.py", comment) is None


def test_content_violation_prefers_forbidden_content_over_length() -> None:
    comment = RawComment(kind="doc", start=1, end=5, text="A\nB\nC\nD\n seit E", standalone=True)

    violation = check_comments.content_violation("a.py", comment)

    assert violation is not None
    assert violation.rule == "inhalt"


def test_group_violations_combines_block_and_content_violations() -> None:
    comments = [
        a_line(2, standalone=True),
        a_line(3, standalone=True),
        a_line(4, standalone=True),
        RawComment(kind="doc", start=10, end=10, text=" seit kurzem", standalone=True),
    ]

    violations = check_comments.group_violations("a.py", comments)

    assert {v.rule for v in violations} == {"block", "inhalt"}


def test_a_violation_key_follows_the_text_not_the_line() -> None:
    first = Violation(path="a.py", line=5, rule="block", text="eins zwei", reason="x")
    moved = Violation(path="a.py", line=99, rule="block", text="eins  zwei", reason="x")
    other = Violation(path="a.py", line=5, rule="block", text="drei", reason="x")

    assert first.key == moved.key
    assert first.key != other.key
    assert first.key.startswith("a.py#")


def test_collect_files_lists_python_files_under_app_and_tools(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(check_comments, "ROOT", tmp_path)
    write_module(tmp_path, "app/a.py", "x = 1\n")
    write_module(tmp_path, "tools/b.py", "y = 2\n")
    write_module(tmp_path, "app/notizen.txt", "kein Python\n")

    files = check_comments.collect_files()

    assert files == [tmp_path / "app" / "a.py", tmp_path / "tools" / "b.py"]


def test_all_violations_collects_across_files(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(check_comments, "ROOT", tmp_path)
    write_module(
        tmp_path,
        "app/a.py",
        "def f() -> None:\n    # eins\n    # zwei\n    # drei\n    return None\n",
    )

    violations = check_comments.all_violations()

    assert len(violations) == 1
    assert violations[0].path == "app/a.py"
    assert violations[0].rule == "block"


def test_read_allow_is_empty_without_a_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(check_comments, "ALLOW_PATH", tmp_path / "lint-allow.json")

    assert check_comments.read_allow() == {}


def test_read_allow_reads_existing_entries(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    allow_path = tmp_path / "lint-allow.json"
    allow_path.write_text(json.dumps({"comments": ["a.py:1"]}), encoding="utf-8")
    monkeypatch.setattr(check_comments, "ALLOW_PATH", allow_path)

    assert check_comments.read_allow() == {"comments": ["a.py:1"]}


def test_write_allow_keeps_other_keys(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    allow_path = tmp_path / "lint-allow.json"
    allow_path.write_text(json.dumps({"size": ["a.py"]}), encoding="utf-8")
    monkeypatch.setattr(check_comments, "ALLOW_PATH", allow_path)

    check_comments.write_allow("comments", ["b.py:2"])

    written = json.loads(allow_path.read_text(encoding="utf-8"))
    assert written == {"size": ["a.py"], "comments": ["b.py:2"]}


def test_main_write_allow_writes_the_current_violations(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(check_comments, "ROOT", tmp_path)
    allow_path = tmp_path / "lint-allow.json"
    monkeypatch.setattr(check_comments, "ALLOW_PATH", allow_path)
    write_module(
        tmp_path,
        "app/a.py",
        "def f() -> None:\n    # eins\n    # zwei\n    # drei\n    return None\n",
    )
    monkeypatch.setattr("sys.argv", ["check_comments", "--write-allow"])

    check_comments.main()

    written = json.loads(allow_path.read_text(encoding="utf-8"))
    assert len(written["comments"]) == 1
    assert written["comments"][0].startswith("app/a.py#")
    assert "1 Ausnahmen für comments geschrieben." in capsys.readouterr().out


def test_main_reports_a_violation_and_exits_with_1(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(check_comments, "ROOT", tmp_path)
    monkeypatch.setattr(check_comments, "ALLOW_PATH", tmp_path / "lint-allow.json")
    write_module(
        tmp_path,
        "app/a.py",
        "def f() -> None:\n    # eins\n    # zwei\n    # drei\n    return None\n",
    )
    monkeypatch.setattr("sys.argv", ["check_comments"])

    with pytest.raises(SystemExit) as ended:
        check_comments.main()

    assert ended.value.code == 1
    printed = capsys.readouterr().out
    assert "app/a.py:2  block" in printed
    assert "Neue Kommentarverstöße: 1." in printed


def test_main_skips_an_allowed_violation_and_exits_cleanly(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(check_comments, "ROOT", tmp_path)
    allow_path = tmp_path / "lint-allow.json"
    monkeypatch.setattr(check_comments, "ALLOW_PATH", allow_path)
    write_module(
        tmp_path,
        "app/a.py",
        "def f() -> None:\n    # eins\n    # zwei\n    # drei\n    return None\n",
    )
    allow_path.write_text(
        json.dumps({"comments": [v.key for v in check_comments.all_violations()]}),
        encoding="utf-8",
    )
    monkeypatch.setattr("sys.argv", ["check_comments"])

    check_comments.main()

    assert "Keine neuen Kommentarverstöße." in capsys.readouterr().out


def test_main_ignores_a_stale_allow_entry(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(check_comments, "ROOT", tmp_path)
    allow_path = tmp_path / "lint-allow.json"
    allow_path.write_text(json.dumps({"comments": ["app/nichtmehr.py:9"]}), encoding="utf-8")
    monkeypatch.setattr(check_comments, "ALLOW_PATH", allow_path)
    write_module(tmp_path, "app/a.py", "x = 1\n")
    monkeypatch.setattr("sys.argv", ["check_comments"])

    check_comments.main()

    assert "Keine neuen Kommentarverstöße." in capsys.readouterr().out

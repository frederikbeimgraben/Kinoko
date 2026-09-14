"""Prüft Kommentarregeln in ``app`` und ``tools``."""

import hashlib
import io
import json
import re
import sys
import tokenize
from dataclasses import dataclass
from pathlib import Path
from typing import Final, cast

ROOT: Final = Path(__file__).resolve().parent.parent
ALLOW_PATH: Final = Path(__file__).resolve().parent / "lint-allow.json"

BLOCK_MAX_LINES: Final = 2
DOC_MAX_LINES: Final = 3

YEAR: Final = re.compile(r"20\d{2}(?:-\d{2}-\d{2})?")
PR_NUMBER: Final = re.compile(r"#\d+|\bPR\s*\d+\b", re.IGNORECASE)
FORBIDDEN_WORDS: Final = re.compile(
    r"(?<![A-Za-zÄÖÜäöüß])(bis|frueher|früher|jetzt|seit)(?![A-Za-zÄÖÜäöüß])",
    re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class RawComment:
    """Ein Kommentar oder Docstring mit Zeilenspanne."""

    kind: str
    start: int
    end: int
    text: str
    standalone: bool


@dataclass(frozen=True, slots=True)
class Violation:
    """Ein gemeldeter Verstoß mit Ort, Regel und Grund."""

    path: str
    line: int
    rule: str
    text: str
    reason: str

    @property
    def key(self) -> str:
        """Schlüssel für die Ausnahmeliste: Pfad und Text, nicht die Zeile."""
        stamp = re.sub(r"\s+", " ", f"{self.rule} {self.text}").strip().encode()
        return f"{self.path}#{hashlib.sha256(stamp).hexdigest()[:8]}"


def forbidden_reason(text: str) -> str | None:
    """Findet den Grund, warum ein Kommentartext verboten ist."""
    if YEAR.search(text):
        return "Jahreszahl oder Datum im Kommentar"
    if PR_NUMBER.search(text):
        return "PR-Nummer im Kommentar"
    word = FORBIDDEN_WORDS.search(text)
    if word:
        return f"verbotenes Wort „{word.group(1)}“"
    return None


def scan_source(text: str) -> list[RawComment]:
    """Zerlegt Quelltext in Kommentare und Docstrings via ``tokenize``."""
    found: list[RawComment] = []
    for tok in tokenize.generate_tokens(io.StringIO(text).readline):
        if tok.type == tokenize.COMMENT:
            before = tok.line[: tok.start[1]]
            found.append(
                RawComment(
                    kind="line",
                    start=tok.start[0],
                    end=tok.start[0],
                    text=tok.string.removeprefix("#"),
                    standalone=before.strip() == "",
                ),
            )
        elif tok.type == tokenize.STRING and (
            tok.string.startswith('"""') or tok.string.startswith("'''")
        ):
            found.append(
                RawComment(
                    kind="doc",
                    start=tok.start[0],
                    end=tok.end[0],
                    text=tok.string[3:-3],
                    standalone=True,
                ),
            )
    return found


def standalone_runs(comments: list[RawComment]) -> list[list[RawComment]]:
    """Gruppiert zusammenhängende, alleinstehende Zeilenkommentare."""
    runs: list[list[RawComment]] = []
    run: list[RawComment] = []
    for comment in comments:
        if comment.kind == "line" and comment.standalone:
            if run and comment.start == run[-1].start + 1:
                run.append(comment)
            else:
                if run:
                    runs.append(run)
                run = [comment]
        else:
            if run:
                runs.append(run)
            run = []
    if run:
        runs.append(run)
    return runs


def run_violations(path: str, runs: list[list[RawComment]]) -> list[Violation]:
    """Meldet Kommentarläufe über der Zeilengrenze."""
    return [
        Violation(
            path,
            r[0].start,
            "block",
            " ".join(c.text for c in r),
            f"{len(r)} zusammenhängende Zeilen",
        )
        for r in runs
        if len(r) > BLOCK_MAX_LINES
    ]


def content_violation(path: str, comment: RawComment) -> Violation | None:
    """Prüft einen Kommentar auf Länge und verbotenen Inhalt."""
    reason = forbidden_reason(comment.text)
    if reason:
        return Violation(path, comment.start, "inhalt", comment.text, reason)
    span = comment.end - comment.start + 1
    if comment.kind == "doc" and span > DOC_MAX_LINES:
        return Violation(
            path,
            comment.start,
            "docstring",
            comment.text,
            f"{span} Zeilen, Grenze {DOC_MAX_LINES}",
        )
    return None


def group_violations(path: str, comments: list[RawComment]) -> list[Violation]:
    """Bildet aus den Rohfunden die Verstöße einer Datei."""
    violations = run_violations(path, standalone_runs(comments))
    violations += [v for c in comments if (v := content_violation(path, c)) is not None]
    return violations


def collect_files() -> list[Path]:
    """Listet die Python-Dateien unter ``app`` und ``tools``."""
    files = {*(ROOT / "app").rglob("*.py"), *(ROOT / "tools").rglob("*.py")}
    return sorted(files)


def all_violations() -> list[Violation]:
    """Sammelt die Verstöße über alle geprüften Dateien."""
    found: list[Violation] = []
    for file in collect_files():
        text = file.read_text(encoding="utf-8")
        rel = file.relative_to(ROOT).as_posix()
        found.extend(group_violations(rel, scan_source(text)))
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
        write_allow("comments", keys)
        print(f"{len(keys)} Ausnahmen für comments geschrieben.")
        return
    allowed = set(read_allow().get("comments", []))
    reported = [v for v in violations if v.key not in allowed]
    for v in reported:
        print(f"{v.path}:{v.line}  {v.rule}  {v.reason}")
    if reported:
        print(f"Neue Kommentarverstöße: {len(reported)}.")
        raise SystemExit(1)
    print("Keine neuen Kommentarverstöße.")


if __name__ == "__main__":
    main()

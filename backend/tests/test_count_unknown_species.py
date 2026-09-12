"""Das Werkzeug, das die Verweise ins Leere vor der Wanderung zaehlt.

Es liest nur. Gegen die Datenbank des Dienstes laeuft es, bevor R4b dort
ankommt, und sagt, ob der Fremdschluessel greifen kann.
"""

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest

from tools import count_unknown_species
from tools.count_unknown_species import report


def a_database(tmp_path: Path, *, with_species: bool = True) -> Path:
    """Eine Datei mit ``species``, ``find`` und ``species_image``."""
    file = tmp_path / "bestand.sqlite"
    with closing(sqlite3.connect(file)) as connection:
        if with_species:
            connection.executescript(
                "CREATE TABLE species (id VARCHAR(36) PRIMARY KEY, slug VARCHAR(80) UNIQUE);"
                "INSERT INTO species VALUES ('art-1', 'steinpilz');"
            )
        connection.executescript(
            "CREATE TABLE find (id VARCHAR(36) PRIMARY KEY, species_slug VARCHAR(64));"
            "CREATE TABLE species_image (id VARCHAR(36) PRIMARY KEY,"
            " species_slug VARCHAR(80));"
        )
        connection.commit()
    return file


def add_find(file: Path, identifier: str, slug: str | None) -> None:
    with closing(sqlite3.connect(file)) as connection:
        connection.execute("INSERT INTO find VALUES (?, ?)", (identifier, slug))
        connection.commit()


def test_a_clean_database_counts_nothing(tmp_path: Path) -> None:
    file = a_database(tmp_path)
    add_find(file, "fund-1", "steinpilz")

    assert report(file) == 0


def test_an_empty_species_counts_as_known(tmp_path: Path) -> None:
    # Leer heisst unbekannt, nicht "zeigt ins Leere". Der Fremdschluessel
    # laesst so einen Fund durch, und das Werkzeug auch.
    file = a_database(tmp_path)
    add_find(file, "fund-1", None)

    assert report(file) == 0


def test_a_find_with_a_species_outside_the_catalogue_counts(tmp_path: Path) -> None:
    file = a_database(tmp_path)
    add_find(file, "fund-1", "gibt-es-nicht")

    assert report(file) == 1


def test_without_the_table_it_says_so_and_counts_nothing(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    # Vor der Wanderung gibt es die Tabelle nicht. Dann ist nichts zu zaehlen:
    # sie legt die Arten selbst an.
    file = a_database(tmp_path, with_species=False)
    add_find(file, "fund-1", "steinpilz")

    assert report(file) == 0
    assert "die Tabelle gibt es noch nicht" in capsys.readouterr().out


def test_the_report_names_every_column(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    report(a_database(tmp_path))

    written = capsys.readouterr().out
    assert "species: 1 Arten" in written
    assert "find.species_slug: 0 ohne Art im Katalog" in written
    assert "species_image.species_slug: 0 ohne Art im Katalog" in written


def test_a_clean_run_ends_without_a_failure(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    file = a_database(tmp_path)
    add_find(file, "fund-1", "steinpilz")
    monkeypatch.setattr("sys.argv", ["count_unknown_species", str(file)])

    count_unknown_species.main()

    assert "Keine Verweise ins Leere" in capsys.readouterr().out


def test_a_reference_into_nothing_ends_with_a_failure(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    # Der Rueckgabewert traegt die Antwort: so laesst sich das Werkzeug vor
    # einem Deploy in ein Skript haengen.
    file = a_database(tmp_path)
    add_find(file, "fund-1", "gibt-es-nicht")
    monkeypatch.setattr("sys.argv", ["count_unknown_species", str(file)])

    with pytest.raises(SystemExit) as ended:
        count_unknown_species.main()

    assert ended.value.code == 1
    assert "1 Zeilen ohne Art" in capsys.readouterr().out

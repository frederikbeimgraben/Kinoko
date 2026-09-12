"""Die Migrationskette. Der Dienst faehrt sie bei jedem Start hoch."""

import re
import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.core import db
from app.core.settings import get_settings
from app.modules.access.permissions import Permission
from app.modules.access.service import BUILT_IN_ROLES

ROOT = Path(__file__).resolve().parents[1]

# Der letzte Schritt vor den Fremdschluesseln aus R4a.
BEFORE_PERSON_KEYS = "e7c3b58a10d2"

# Der letzte Schritt vor den neuen Plakettentexten.
BEFORE_BADGE_LABELS = "a8f2c50d7b31"


def configuration() -> Config:
    """Liest die alembic.ini, so wie der Dienst sie im Arbeitsverzeichnis liest."""
    return Config(ROOT / "alembic.ini")


def tables(file: Path) -> set[str]:
    frage = "SELECT name FROM sqlite_master WHERE type='table'"
    with closing(sqlite3.connect(file)) as connection:
        return {name for (name,) in connection.execute(frage)}


def test_there_is_exactly_one_head() -> None:
    skripte = ScriptDirectory.from_config(configuration())

    assert len(skripte.get_heads()) == 1


def test_upgrade_creates_the_schema_on_an_empty_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = tmp_path / "leer.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()

    command.upgrade(configuration(), "head")

    expected = {
        "user",
        "find",
        "photo",
        "marker",
        "zone",
        "combination",
        "role",
        "permission",
        "role_permission",
        "user_role",
        "text",
        "species_image",
    }

    assert expected | {"alembic_version"} <= tables(file)


def test_upgrade_also_runs_on_an_existing_database(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = tmp_path / "zweimal.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()

    # Die Baseline legt die Tabellen mit IF NOT EXISTS an. Ein zweiter Lauf nach
    # einem Downgrade darf darum nicht scheitern.
    command.upgrade(configuration(), "head")
    db.engine.cache_clear()
    command.downgrade(configuration(), "base")
    db.engine.cache_clear()
    command.upgrade(configuration(), "head")

    assert {
        "user",
        "find",
        "photo",
        "marker",
        "zone",
        "combination",
        "role",
        "permission",
        "role_permission",
        "user_role",
        "text",
        "species_image",
    } <= tables(file)


def columns(file: Path, table: str) -> set[str]:
    with closing(sqlite3.connect(file)) as connection:
        return {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}


def rows(file: Path, query: str) -> list[tuple[str, ...]]:
    """Die Zeilen einer Abfrage, jede Spalte als Zeichenkette."""
    with closing(sqlite3.connect(file)) as connection:
        return [tuple(str(value) for value in row) for row in connection.execute(query)]


def test_the_upgrade_seeds_the_catalogue_and_the_built_in_roles(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Eine frisch hochgezogene Datenbank ist vollständig, auch bevor der
    # Dienst zum ersten Mal startet.
    file = tmp_path / "gefuellt.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()

    command.upgrade(configuration(), "head")

    keys = {key for (key,) in rows(file, "SELECT key FROM permission")}
    built_in = rows(file, "SELECT slug, name FROM role WHERE built_in")
    assert keys == {right.value for right in Permission}
    assert set(built_in) == {(role.slug, role.name) for role in BUILT_IN_ROLES}


def test_a_second_upgrade_seeds_nothing_twice(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = tmp_path / "zweimal_gefuellt.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()

    command.upgrade(configuration(), "head")
    db.engine.cache_clear()
    command.upgrade(configuration(), "head")

    assert len(rows(file, "SELECT slug FROM role")) == len(BUILT_IN_ROLES)
    assert len(rows(file, "SELECT key FROM permission")) == len(Permission)


# Der Verweis auf ``user``, so wie SQLite ihn in der Tabellendefinition führt.
PERSON_KEY = re.compile(
    r",\s*CONSTRAINT fk_\w+_user FOREIGN KEY\([^)]*\)"
    r' REFERENCES "?user"? \(sub\)(?: ON DELETE [A-Z ]+)?'
)

# Dieselbe Sache fuer den Verweis auf eine Art aus R4b. Die Baseline baut aus
# den heutigen Modellen und schreibt beide Bedingungen; der Bestand im Betrieb
# ist aelter und traegt keine davon.
SPECIES_KEY = re.compile(
    r",\s*CONSTRAINT fk_\w+_species FOREIGN KEY\([^)]*\)"
    r' REFERENCES "?species"? \(slug\)(?: ON DELETE [A-Z ]+)?'
)

# Die Tabellen, die nach R4a auf ein Konto zeigen.
POINTING_AT_A_PERSON = (
    "find",
    "marker",
    "zone",
    "combination",
    "species_image",
    "text",
    "user_role",
)


def as_before_the_keys(file: Path, table: str) -> None:
    """Baut eine Tabelle ohne ihre Verweise auf ``user`` und ``species`` nach.

    Die Baseline legt das Schema aus den Modellen an, darum traegt schon eine
    frische Datenbank den Fremdschluessel. Der Bestand im Betrieb ist aelter
    und traegt ihn nicht. Nur an diesem aelteren Stand laesst sich pruefen, was
    die Wanderung tut.
    """
    with closing(sqlite3.connect(file)) as connection:
        query = "SELECT sql FROM sqlite_master WHERE type='table' AND name=?"
        (definition,) = connection.execute(query, (table,)).fetchone()
        # Ohne ``legacy_alter_table`` zieht SQLite jeden Verweis auf diese
        # Tabelle auf den neuen Namen um. ``photo`` zeigte danach auf
        # ``find_alt``, und die Vorrichtung baute einen Fehler nach, den es
        # nicht gibt. Alembic schaltet die Pragma aus demselben Grund.
        connection.executescript(
            "PRAGMA legacy_alter_table=ON;"  # noqa: S608 - Name aus POINTING_AT_A_PERSON
            f"ALTER TABLE {table} RENAME TO {table}_alt;"
            f"{SPECIES_KEY.sub('', PERSON_KEY.sub('', definition))};"
            f"INSERT INTO {table} SELECT * FROM {table}_alt;"
            f"DROP TABLE {table}_alt;"
            "PRAGMA legacy_alter_table=OFF;"
        )
        connection.commit()


def grown_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, name: str) -> Path:
    """Eine Datenbank auf dem Stand vor R4a, so wie sie im Betrieb steht."""
    file = tmp_path / name
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()
    command.upgrade(configuration(), BEFORE_PERSON_KEYS)
    for table in POINTING_AT_A_PERSON:
        as_before_the_keys(file, table)
    db.engine.cache_clear()
    return file


def add_find(file: Path, sub: str) -> None:
    """Legt einen Fund an, ohne den Weg ueber die Modelle."""
    with closing(sqlite3.connect(file)) as connection:
        connection.execute(
            "INSERT INTO find (id, owner_sub, created_at, updated_at, species_slug,"
            " lat, lon, found_on, for_training, visibility)"
            " VALUES (?, ?, '2026-09-01 00:00:00', '2026-09-01 00:00:00', 'steinpilz',"
            " 48.5, 9.2, '2026-09-01', 0, 'privat')",
            (f"find-{sub}", sub),
        )
        connection.commit()


def add_person(file: Path, sub: str) -> None:
    with closing(sqlite3.connect(file)) as connection:
        connection.execute(
            "INSERT INTO \"user\" (sub, created_at) VALUES (?, '2026-09-01 00:00:00')",
            (sub,),
        )
        connection.commit()


def points_at(file: Path, table: str) -> set[str]:
    """Die Tabellen, auf die eine Tabelle verweist."""
    with closing(sqlite3.connect(file)) as connection:
        return {row[2] for row in connection.execute(f"PRAGMA foreign_key_list({table})")}


def test_a_grown_database_starts_without_the_keys(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Haelt die Vorrichtung selbst fest: ohne diesen Ausgangsstand pruefen die
    # beiden Tests darunter nichts.
    file = grown_database(tmp_path, monkeypatch, "vorher.sqlite")

    assert points_at(file, "find") == set()
    assert points_at(file, "user_role") == {"role"}
    assert points_at(file, "photo") == {"find"}


def test_a_find_without_an_account_stops_the_upgrade(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Ohne die Zaehlung braeche die Wanderung erst an der Bedingung ab und
    # nennte eine einzelne Zeile. Die Meldung soll sagen, wo und wie viele.
    file = grown_database(tmp_path, monkeypatch, "waise.sqlite")
    add_find(file, "niemand")

    with pytest.raises(RuntimeError) as stopped:
        command.upgrade(configuration(), "head")

    assert "find.owner_sub: 1" in str(stopped.value)
    assert points_at(file, "find") == set()


def test_the_upgrade_adds_the_keys_to_a_grown_database(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = grown_database(tmp_path, monkeypatch, "gewachsen.sqlite")
    add_person(file, "nutzer-1")
    add_find(file, "nutzer-1")

    command.upgrade(configuration(), "head")

    for table in POINTING_AT_A_PERSON:
        assert "user" in points_at(file, table), table


def test_the_downgrade_takes_the_keys_away_again(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = grown_database(tmp_path, monkeypatch, "zurueck.sqlite")
    command.upgrade(configuration(), "head")
    db.engine.cache_clear()

    command.downgrade(configuration(), BEFORE_PERSON_KEYS)

    assert points_at(file, "find") == set()
    assert points_at(file, "user_role") == {"role"}


def add_photo(file: Path, find_id: str) -> None:
    with closing(sqlite3.connect(file)) as connection:
        connection.execute(
            "INSERT INTO photo (id, find_id, filename, width, height, created_at)"
            " VALUES ('foto-1', ?, 'bild.jpg', 1600, 1200, '2026-09-01 00:00:00')",
            (find_id,),
        )
        connection.commit()


def test_the_upgrade_keeps_the_photos_of_a_find(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Die Wanderung baut ``find`` neu, und ``photo.find_id`` löscht mit dem
    # Fund. Baute sie die Tabelle bei eingeschalteten Fremdschluesseln ab,
    # naehme sie die Fotos still mit. Dieser Test haelt fest, dass sie bleiben.
    file = grown_database(tmp_path, monkeypatch, "mit_foto.sqlite")
    add_person(file, "nutzer-1")
    add_find(file, "nutzer-1")
    add_photo(file, "find-nutzer-1")

    command.upgrade(configuration(), "head")

    assert rows(file, "SELECT id FROM photo") == [("foto-1",)]
    assert points_at(file, "photo") == {"find"}


def text_of(file: Path, key: str, locale: str) -> str | None:
    """Der Wert eines Oberflaechentextes, am Modell vorbei gelesen."""
    with closing(sqlite3.connect(file)) as connection:
        found = connection.execute(
            "SELECT value FROM text WHERE key = ? AND locale = ?", (key, locale)
        ).fetchone()
    return None if found is None else str(found[0])


def set_text(file: Path, key: str, locale: str, value: str) -> None:
    with closing(sqlite3.connect(file)) as connection:
        connection.execute(
            "UPDATE text SET value = ? WHERE key = ? AND locale = ?", (value, key, locale)
        )
        connection.commit()


def before_the_labels(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, name: str) -> Path:
    """Eine Datenbank auf dem Stand vor den neuen Plakettentexten."""
    file = tmp_path / name
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()
    command.upgrade(configuration(), BEFORE_BADGE_LABELS)
    db.engine.cache_clear()
    return file


def test_the_upgrade_moves_a_label_that_still_holds_the_default(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Der Anfangsbestand der Wanderung traegt schon den neuen Text; ein
    # gewachsener Bestand traegt den alten, und ``sync_texts`` fasst einen
    # vorhandenen Wert nie an. Ohne diesen Schritt stuende dort ewig der alte.
    file = before_the_labels(tmp_path, monkeypatch, "plaketten.sqlite")
    set_text(file, "art.handel.ja", "de", "auf der Positivliste")

    command.upgrade(configuration(), "head")

    assert text_of(file, "art.handel.ja", "de") == "DGfM-Positivliste"
    assert text_of(file, "art.essbar.essbar", "de") == "essbar"


def test_the_upgrade_keeps_a_label_someone_wrote_themselves(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Wer den Text in der Oberflaeche geaendert hat, behaelt seine Fassung.
    file = before_the_labels(tmp_path, monkeypatch, "eigener-text.sqlite")
    set_text(file, "art.handel.ja", "de", "steht auf der Liste des Vereins")

    command.upgrade(configuration(), "head")

    assert text_of(file, "art.handel.ja", "de") == "steht auf der Liste des Vereins"


def test_the_downgrade_puts_the_old_labels_back(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = before_the_labels(tmp_path, monkeypatch, "zurueck-plaketten.sqlite")
    command.upgrade(configuration(), "head")
    db.engine.cache_clear()

    command.downgrade(configuration(), BEFORE_BADGE_LABELS)

    assert text_of(file, "art.handel.ja", "de") == "auf der Positivliste"


# Der Stand vor der Umbenennung, so wie er im Betrieb steht: die Tabellen
# heissen deutsch und tragen die Fremdschlüssel aus R4a.
BEFORE_ENGLISH = "c9e4b7a13d86"

GERMAN_SCHEMA = """
CREATE TABLE nutzer (
    sub VARCHAR(255) NOT NULL PRIMARY KEY,
    email VARCHAR(255), name VARCHAR(255), erstellt_am DATETIME NOT NULL);
CREATE TABLE fund (
    besitzer_name VARCHAR(255), art_slug VARCHAR(64) NOT NULL,
    lat FLOAT NOT NULL, lon FLOAT NOT NULL, datum DATE NOT NULL, anzahl INTEGER,
    fuer_training BOOLEAN DEFAULT 0 NOT NULL, sichtbarkeit VARCHAR(16) NOT NULL,
    notiz TEXT, id VARCHAR(36) NOT NULL PRIMARY KEY,
    erstellt_am DATETIME NOT NULL, geaendert_am DATETIME NOT NULL,
    besitzer_sub VARCHAR(255) NOT NULL,
    CONSTRAINT fk_fund_besitzer_sub_nutzer FOREIGN KEY(besitzer_sub)
        REFERENCES nutzer (sub) ON DELETE RESTRICT);
CREATE TABLE foto (
    id VARCHAR(36) NOT NULL PRIMARY KEY, fund_id VARCHAR(36) NOT NULL,
    dateiname VARCHAR(64) NOT NULL, breite INTEGER NOT NULL, hoehe INTEGER NOT NULL,
    erstellt_am DATETIME NOT NULL,
    FOREIGN KEY(fund_id) REFERENCES fund (id) ON DELETE CASCADE);
"""


def a_german_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, name: str) -> Path:
    """Baut den deutschen Stand nach und stempelt ihn auf den Kopf davor.

    Nachgebaut statt hochgezogen: die Baseline folgt den Modellen, und die
    sprechen seit diesem Schritt englisch. Der alte Stand lässt sich darum
    nicht mehr aus der Kette erzeugen, nur noch aus seinem Text.
    """
    file = tmp_path / name
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()
    with closing(sqlite3.connect(file)) as connection:
        connection.executescript(GERMAN_SCHEMA)
        connection.commit()
    command.stamp(configuration(), BEFORE_ENGLISH)
    db.engine.cache_clear()
    return file


def a_find_in_german(file: Path) -> None:
    with closing(sqlite3.connect(file)) as connection:
        connection.executescript(
            "INSERT INTO nutzer VALUES"
            " ('nutzer-1', 'pilz@example.test', 'Pilzsammlerin', '2026-09-01 00:00:00');"
            "INSERT INTO fund VALUES"
            " ('Pilzsammlerin', 'steinpilz', 48.5, 9.2, '2026-09-01', 3, 0, 'privat',"
            " 'am Hang', 'fund-1', '2026-09-01 00:00:00', '2026-09-01 00:00:00', 'nutzer-1');"
            "INSERT INTO foto VALUES"
            " ('foto-1', 'fund-1', 'bild.jpg', 1600, 1200, '2026-09-01 00:00:00');"
        )
        connection.commit()


def test_the_upgrade_renames_the_german_tables(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = a_german_database(tmp_path, monkeypatch, "deutsch.sqlite")

    command.upgrade(configuration(), "head")

    names = tables(file)
    assert {"user", "find", "photo"} <= names
    assert not ({"nutzer", "fund", "foto"} & names)


def test_the_upgrade_renames_the_german_columns(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    file = a_german_database(tmp_path, monkeypatch, "spalten.sqlite")

    command.upgrade(configuration(), "head")

    assert {"owner_sub", "species_slug", "found_on", "for_training", "created_at"} <= columns(
        file, "find"
    )
    assert "besitzer_sub" not in columns(file, "find")


def test_the_upgrade_carries_every_row_across(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Eine Umbenennung darf nichts kosten. Der Fund kommt mit jedem Wert an,
    # und sein Foto hängt weiter an ihm.
    file = a_german_database(tmp_path, monkeypatch, "inhalt.sqlite")
    a_find_in_german(file)

    command.upgrade(configuration(), "head")

    assert rows(file, "SELECT species_slug, found_on, count, note, owner_sub FROM find") == [
        ("steinpilz", "2026-09-01", "3", "am Hang", "nutzer-1")
    ]
    assert rows(file, "SELECT find_id, filename, width FROM photo") == [
        ("fund-1", "bild.jpg", "1600")
    ]
    assert rows(file, "SELECT sub, created_at FROM user") == [("nutzer-1", "2026-09-01 00:00:00")]


def test_the_upgrade_keeps_the_photo_pointing_at_its_find(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # SQLite schreibt Verweise beim Umbenennen mit. Ohne das zeigte ``photo``
    # nach dem Schritt auf eine Tabelle namens ``fund``, die es nicht gibt.
    file = a_german_database(tmp_path, monkeypatch, "verweis.sqlite")

    command.upgrade(configuration(), "head")

    assert points_at(file, "photo") == {"find"}
    # Seit R4b zeigt der Fund auch auf die Art, die er nennt.
    assert points_at(file, "find") == {"user", "species"}


def test_the_upgrade_renames_the_constraints_too(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Der Name einer Bedingung steht im Text der Tabelle und wandert nicht
    # mit. Bliebe er stehen, hiesse die Bedingung weiter nach der Tabelle,
    # die es nicht mehr gibt, und ein späterer Schritt fände sie nicht.
    file = a_german_database(tmp_path, monkeypatch, "bedingung.sqlite")

    command.upgrade(configuration(), "head")

    with closing(sqlite3.connect(file)) as connection:
        (definition,) = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='find'"
        ).fetchone()
    assert "fk_find_owner_sub_user" in definition
    assert "besitzer" not in definition


def test_a_fresh_database_needs_no_renaming(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Die Baseline folgt den Modellen und legt schon englisch an. Der Schritt
    # muss darüber hinweggehen, statt an einer fehlenden Tabelle zu scheitern.
    file = tmp_path / "frisch.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{file}")
    get_settings.cache_clear()
    db.engine.cache_clear()

    command.upgrade(configuration(), "head")

    assert {"user", "find", "photo", "combination", "term"} <= tables(file)


def schema_of(file: Path) -> dict[str, list[tuple[str, str]]]:
    """Jede Tabelle mit ihren Spalten und Typen, ohne die Buchhaltung."""
    with closing(sqlite3.connect(file)) as connection:
        names = [
            name
            for (name,) in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name != 'alembic_version'"
            )
        ]
        return {
            name: [(row[1], row[2]) for row in connection.execute(f"PRAGMA table_info({name})")]
            for name in sorted(names)
        }


def test_a_migrated_database_looks_like_a_fresh_one(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Der eigentliche Nachweis: eine gewachsene deutsche Datenbank kommt nach
    # der Wanderung auf dasselbe Schema wie eine, die heute frisch entsteht.
    # Ohne diesen Vergleich bliebe offen, ob die Umbenennung etwas ausgelassen
    # hat, das nur im Bestand steht.
    grown = a_german_database(tmp_path, monkeypatch, "gewachsen.sqlite")
    command.upgrade(configuration(), "head")

    fresh = tmp_path / "frisch.sqlite"
    monkeypatch.setenv("PILZE_DB", f"sqlite+aiosqlite:///{fresh}")
    get_settings.cache_clear()
    db.engine.cache_clear()
    command.upgrade(configuration(), "head")

    # Die Vorrichtung baut die drei Tabellen von Hand nach, um die es hier
    # geht; was eine spaetere Migration selbst anlegt, kommt dazu. Verglichen
    # wird darum, was beide Datenbanken tragen, nicht was der einen fehlt.
    von_hand = schema_of(grown)
    frisch = schema_of(fresh)
    assert {"user", "find", "photo"} <= set(von_hand)
    for name in set(von_hand) & set(frisch):
        assert von_hand[name] == frisch[name], name

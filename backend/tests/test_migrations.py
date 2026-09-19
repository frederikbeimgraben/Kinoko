"""Die Baseline und das Modell sagen dasselbe."""

import hashlib
import os
import re
from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect

from app.core import db
from app.core.settings import get_settings
from app.models import Base

ROOT = Path(__file__).resolve().parents[1]
VERSIONS = ROOT / "migrations" / "versions"
REVISION_LINE = re.compile(r'^revision: str = "(?P<id>[^"]+)"$', re.MULTILINE)

# Der Abdruck je Revision. Eine geänderte Baseline braucht eine neue Kennung
# und einen neuen Dateinamen. Ohne neue Kennung behält eine Datenbank ihre
# alten Tabellen, weil ``env.py`` nur eine unbekannte Kennung verwirft.
FINGERPRINTS = {
    "baseline_4": "5d02d04b54ad8c1babfb1cb69c51aa4fd2bbc93dd0215a7c83d4c3c50e92316b",
}


def revision_of(file: Path) -> str:
    """Die Kennung einer Wanderung."""
    found = REVISION_LINE.search(file.read_text(encoding="utf-8"))
    assert found is not None, file.name
    return found.group("id")


def fingerprint(file: Path) -> str:
    """Der Abdruck einer Wanderung, ohne ihre Zeile ``revision``."""
    body = REVISION_LINE.sub("", file.read_text(encoding="utf-8"))
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def test_every_revision_keeps_its_content() -> None:
    found = {revision_of(file): fingerprint(file) for file in VERSIONS.glob("*.py")}
    assert found == FINGERPRINTS


def alembic_config() -> Config:
    """Die Konfiguration aus ``alembic.ini``."""
    return Config(ROOT / "alembic.ini")


def point_at(file: Path) -> None:
    """Richtet die Einstellungen auf eine Datei aus."""
    os.environ["PILZE_DB"] = f"sqlite+aiosqlite:///{file}"
    get_settings.cache_clear()
    db.engine.cache_clear()


def tables_of(file: Path) -> set[str]:
    """Die Tabellen einer SQLite-Datei."""
    made = create_engine(f"sqlite:///{file}")
    with made.connect() as connection:
        found = set(inspect(connection).get_table_names())
    made.dispose()
    return found


def test_one_head() -> None:
    assert len(ScriptDirectory.from_config(alembic_config()).get_heads()) == 1


def test_upgrade_builds_every_table(tmp_path: Path) -> None:
    file = tmp_path / "wanderung.sqlite"
    point_at(file)
    command.upgrade(alembic_config(), "head")
    assert set(Base.metadata.tables) <= tables_of(file)


def test_baseline_matches_the_model(tmp_path: Path) -> None:
    file = tmp_path / "abgleich.sqlite"
    point_at(file)
    command.upgrade(alembic_config(), "head")
    made = create_engine(f"sqlite:///{file}")
    with made.connect() as connection:
        difference = compare_metadata(MigrationContext.configure(connection), Base.metadata)
    made.dispose()
    assert not difference, difference


def test_downgrade_empties_the_database(tmp_path: Path) -> None:
    file = tmp_path / "zurueck.sqlite"
    point_at(file)
    command.upgrade(alembic_config(), "head")
    command.downgrade(alembic_config(), "base")
    assert tables_of(file) <= {"alembic_version"}


def test_upgrade_resets_a_foreign_revision(tmp_path: Path) -> None:
    file = tmp_path / "fremd.sqlite"
    point_at(file)
    made = create_engine(f"sqlite:///{file}")
    with made.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"
        )
        connection.exec_driver_sql("INSERT INTO alembic_version VALUES ('c2d8e5f14a07')")
        connection.exec_driver_sql("CREATE TABLE relikt (id INTEGER)")
    made.dispose()

    command.upgrade(alembic_config(), "head")

    found = tables_of(file)
    assert set(Base.metadata.tables) <= found
    assert "relikt" not in found

    made = create_engine(f"sqlite:///{file}")
    with made.connect() as connection:
        version = connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one()
    made.dispose()
    assert version == "baseline_4"


def test_upgrade_resets_the_old_baseline_revision(tmp_path: Path) -> None:
    file = tmp_path / "alte_baseline.sqlite"
    point_at(file)
    made = create_engine(f"sqlite:///{file}")
    with made.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"
        )
        connection.exec_driver_sql("INSERT INTO alembic_version VALUES ('baseline_3')")
    Base.metadata.create_all(made)
    made.dispose()

    command.upgrade(alembic_config(), "head")

    found = tables_of(file)
    assert set(Base.metadata.tables) <= found

    made = create_engine(f"sqlite:///{file}")
    with made.connect() as connection:
        version = connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one()
    made.dispose()
    assert version == "baseline_4"


def test_upgrade_resets_tables_without_a_version(tmp_path: Path) -> None:
    file = tmp_path / "ohne_version.sqlite"
    point_at(file)
    made = create_engine(f"sqlite:///{file}")
    Base.metadata.create_all(made)
    made.dispose()

    command.upgrade(alembic_config(), "head")

    found = tables_of(file)
    assert set(Base.metadata.tables) <= found

    made = create_engine(f"sqlite:///{file}")
    with made.connect() as connection:
        version = connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one()
    made.dispose()
    assert version == "baseline_4"

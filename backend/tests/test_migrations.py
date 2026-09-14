"""Die Baseline und das Modell sagen dasselbe."""

import os
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

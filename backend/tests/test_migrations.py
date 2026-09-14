"""Die Baseline und das Modell sagen dasselbe."""

from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from app.models import Base

ROOT = Path(__file__).resolve().parents[1]


def alembic_config() -> Config:
    """Die Konfiguration aus ``alembic.ini``."""
    return Config(ROOT / "alembic.ini")


def test_one_head() -> None:
    from alembic.script import ScriptDirectory

    assert len(ScriptDirectory.from_config(alembic_config()).get_heads()) == 1


def test_upgrade_builds_every_table(tmp_path: Path, monkeypatch: object) -> None:
    file = tmp_path / "wanderung.sqlite"
    import os

    os.environ["PILZE_DB"] = f"sqlite+aiosqlite:///{file}"
    from app.core import db
    from app.core.settings import get_settings

    get_settings.cache_clear()
    db.engine.cache_clear()
    command.upgrade(alembic_config(), "head")
    made = create_engine(f"sqlite:///{file}")
    with made.connect() as connection:
        found = set(inspect(connection).get_table_names())
    made.dispose()
    assert set(Base.metadata.tables) <= found


def test_baseline_matches_the_model(tmp_path: Path) -> None:
    file = tmp_path / "abgleich.sqlite"
    import os

    os.environ["PILZE_DB"] = f"sqlite+aiosqlite:///{file}"
    from app.core import db
    from app.core.settings import get_settings

    get_settings.cache_clear()
    db.engine.cache_clear()
    command.upgrade(alembic_config(), "head")
    made = create_engine(f"sqlite:///{file}")
    with made.connect() as connection:
        context = MigrationContext.configure(connection)
        difference = compare_metadata(context, Base.metadata)
    made.dispose()
    assert not difference, difference


def test_downgrade_empties_the_database(tmp_path: Path) -> None:
    file = tmp_path / "zurueck.sqlite"
    import os

    os.environ["PILZE_DB"] = f"sqlite+aiosqlite:///{file}"
    from app.core import db
    from app.core.settings import get_settings

    get_settings.cache_clear()
    db.engine.cache_clear()
    command.upgrade(alembic_config(), "head")
    command.downgrade(alembic_config(), "base")
    made = create_engine(f"sqlite:///{file}")
    with made.connect() as connection:
        found = set(inspect(connection).get_table_names())
    made.dispose()
    assert found <= {"alembic_version"}

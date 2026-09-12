"""Die Art wird eine Tabelle, mit vierzehn Kindtabellen.

Revision ID: f3b7c92e480d
Revises: b8e4d1a37f26
"""

from collections.abc import Sequence
from typing import Final

import sqlalchemy as sa
from alembic import op
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateIndex, CreateTable, DropTable

from app.models import SPECIES_KEYS, Base, Term, species_key
from app.modules.species.catalog import DATA, read_profiles
from app.modules.species.store import plan, term_index

revision: str = "f3b7c92e480d"
down_revision: str | None = "b8e4d1a37f26"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SPECIES: Final = "species"

# Erst das Elternteil, dann die Kinder. Die Reihenfolge zaehlt beim Anlegen wie
# beim Abraeumen, nur umgekehrt.
TABLES: Final[tuple[str, ...]] = (
    SPECIES,
    "species_name",
    "species_measurement",
    "species_colour",
    "species_colour_change",
    "species_cap_feature",
    "species_cap_margin",
    "species_stem_feature",
    "species_reagent",
    "species_trait",
    "species_source",
    "species_season",
    "species_tree",
    "species_term",
    "species_lookalike",
)


def _pending(table: str, name: str) -> bool:
    """Sagt, ob die Bedingung an dieser Tabelle noch fehlt.

    Eine frische Datenbank baut die Baseline aus den Modellen, und dort steht
    der Schluessel bereits. Eine von Hand gesetzte Datenbank kann die Tabelle
    gar nicht haben; auch dann ist nichts zu tun.
    """
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table):
        return False
    return not any(key["name"] == name for key in inspector.get_foreign_keys(table))


def _unknown(table: str, column: str) -> int:
    """Zaehlt die Zeilen, deren Art es nicht gibt. Leere Werte zaehlen nicht."""
    query = sa.text(
        f"SELECT count(*) FROM {table} t"  # noqa: S608 - Namen stehen in SPECIES_KEYS
        f" WHERE t.{column} IS NOT NULL"
        f" AND NOT EXISTS (SELECT 1 FROM {SPECIES} s WHERE s.slug = t.{column})"
    )
    return int(op.get_bind().scalar(query) or 0)


def _seed() -> None:
    """Schreibt die Profile aus ``daten/arten`` in die neuen Tabellen.

    Die TOML-Dateien bleiben der Anfangsbestand, wie ``daten/texte.json`` bei
    den Oberflaechentexten: die Wanderung liest sie ein, danach ist die Tabelle
    die Wahrheit.

    Ueber dieselben Bauplaene wie der Dienst. Zwei Wege in dieselben Tabellen
    liefen auseinander, sobald eine Spalte dazukommt.
    """
    session = Session(bind=op.get_bind())
    # Eine Datenbank, die von Hand auf einen Stand gesetzt wurde, kann die
    # Begriffe noch nicht haben. Dann gibt es auch keine Verweise darauf; die
    # Arten selbst stehen trotzdem, und nur auf sie zeigt der Fremdschluessel.
    known = sa.inspect(op.get_bind()).has_table("term")
    index = term_index(session.scalars(sa.select(Term)).all()) if known else {}
    _, stages = plan(read_profiles(DATA / "arten"), index)
    for stage in stages:
        session.add_all(stage)
        session.flush()
    session.commit()


def upgrade() -> None:
    """Legt die Tabellen an, fuellt sie und haengt dann die zwei Verweise an."""
    connection = op.get_bind()
    for name in TABLES:
        table = Base.metadata.tables[name]
        connection.execute(CreateTable(table, if_not_exists=True))
        for index in table.indexes:
            connection.execute(CreateIndex(index, if_not_exists=True))

    species = Base.metadata.tables[SPECIES]
    if not connection.scalar(sa.select(sa.func.count()).select_from(species)):
        _seed()

    # Erst zaehlen, dann bauen, wie bei den Konten in R4a: eine Bedingung, die
    # an einer unbekannten Art scheitert, bricht mitten in der Wanderung ab und
    # sagt nur, welche Zeile es war.
    found = {
        f"{table}.{column}": _unknown(table, column)
        for table, column in SPECIES_KEYS
        if _pending(table, species_key(table, column))
    }
    broken = {place: count for place, count in found.items() if count > 0}
    if broken:
        places = ", ".join(f"{place}: {count}" for place, count in sorted(broken.items()))
        raise RuntimeError(
            "Es gibt Zeilen, deren Art der Katalog nicht kennt. Erst muessen sie"
            f" eine Art bekommen oder leer werden, dann greift der Fremdschluessel. {places}."
        )

    for table, column in SPECIES_KEYS:
        name = species_key(table, column)
        if not _pending(table, name):
            continue
        # SQLite kennt kein ``ADD CONSTRAINT``. Alembic baut die Tabelle neu und
        # kopiert sie um.
        with op.batch_alter_table(table) as batch:
            if table == "find":
                # Nur der Fund darf die Art offen lassen. Ein Artbild ohne Art
                # gibt es heute nicht; das kommt mit R4c.
                batch.alter_column(column, existing_type=sa.String(64), nullable=True)
            batch.create_foreign_key(name, SPECIES, [column], ["slug"], ondelete="RESTRICT")


def downgrade() -> None:
    """Nimmt die Verweise zurueck und raeumt die Tabellen ab."""
    for table, column in SPECIES_KEYS:
        name = species_key(table, column)
        if _pending(table, name):
            continue
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(name, type_="foreignkey")
    connection = op.get_bind()
    for name in reversed(TABLES):
        connection.execute(DropTable(Base.metadata.tables[name], if_exists=True))

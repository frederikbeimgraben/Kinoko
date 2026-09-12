"""Tabellen und Spalten auf Englisch.

Revision ID: c4e9b1d7a206
Revises: c9e4b7a13d86
"""

from collections.abc import Sequence
from typing import Final

import sqlalchemy as sa
from alembic import op

from app.models import Base

revision: str = "c4e9b1d7a206"
down_revision: str | None = "c9e4b7a13d86"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RENAMED_TABLES: Final[tuple[tuple[str, str], ...]] = (
    ("nutzer", "user"),
    ("fund", "find"),
    ("foto", "photo"),
    ("kombination", "combination"),
    ("begriff", "term"),
)

# Je Tabelle unter ihrem neuen Namen, weil die Tabellen zuerst wandern.
RENAMED_COLUMNS: Final[dict[str, tuple[tuple[str, str], ...]]] = {
    "user": (("erstellt_am", "created_at"),),
    "term": (("art", "kind"), ("reihenfolge", "position")),
    "find": (
        ("besitzer_name", "owner_name"),
        ("art_slug", "species_slug"),
        ("datum", "found_on"),
        ("anzahl", "count"),
        ("fuer_training", "for_training"),
        ("sichtbarkeit", "visibility"),
        ("notiz", "note"),
        ("erstellt_am", "created_at"),
        ("geaendert_am", "updated_at"),
        ("besitzer_sub", "owner_sub"),
    ),
    "photo": (
        ("fund_id", "find_id"),
        ("dateiname", "filename"),
        ("breite", "width"),
        ("hoehe", "height"),
        ("erstellt_am", "created_at"),
    ),
    "marker": (
        ("farbe", "color"),
        ("sichtbarkeit", "visibility"),
        ("notiz", "note"),
        ("erstellt_am", "created_at"),
        ("geaendert_am", "updated_at"),
        ("besitzer_sub", "owner_sub"),
    ),
    "zone": (
        ("flaeche_ha", "area_ha"),
        ("farbe", "color"),
        ("sichtbarkeit", "visibility"),
        ("notiz", "note"),
        ("erstellt_am", "created_at"),
        ("geaendert_am", "updated_at"),
        ("besitzer_sub", "owner_sub"),
    ),
    "combination": (
        ("regel", "rule"),
        ("faktoren", "factors"),
        ("erstellt_am", "created_at"),
        ("geaendert_am", "updated_at"),
        ("besitzer_sub", "owner_sub"),
    ),
}

# Diese Tabellen trugen einen deutschen Namen in einer Bedingung: der Verweis
# auf das Konto hiess ``fk_fund_besitzer_sub_nutzer``. Ein Name steht in
# SQLite im Text der Tabelle und wandert nicht mit, wenn Tabelle oder Spalte
# umbenannt wird. Darum werden sie am Ende aus den Modellen nachgebaut.
REBUILT: Final[tuple[str, ...]] = (
    "find",
    "marker",
    "zone",
    "combination",
    "species_image",
    "text",
    "user_role",
    "term",
)


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def _rename(pairs: tuple[tuple[str, str], ...], table: str) -> None:
    """Benennt die Spalten um, die noch ihren alten Namen tragen."""
    present = _columns(table)
    for old, new in pairs:
        if old in present and new not in present:
            # Kein Batch: SQLite kann eine Spalte seit 3.25 an Ort und Stelle
            # umbenennen und zieht Index und Fremdschluessel selbst nach. Ein
            # Umbau der Tabelle waere mehr Bewegung fuer dasselbe Ergebnis.
            op.execute(f'ALTER TABLE "{table}" RENAME COLUMN "{old}" TO "{new}"')


def upgrade() -> None:
    """Zieht Tabellen und Spalten auf die Namen der Modelle nach.

    Eine frische Datenbank hat die englischen Namen schon aus der Baseline;
    jeder Schritt fragt darum erst, ob es etwas zu tun gibt. Zu tun gibt es
    nur auf einer gewachsenen Datenbank etwas.
    """
    tables = _tables()
    for old, new in RENAMED_TABLES:
        if old in tables and new not in tables:
            # SQLite schreibt beim Umbenennen jeden Verweis anderer Tabellen
            # auf diese hier mit. Genau das ist hier gewollt: ``photo`` soll
            # nach dem Schritt auf ``find`` zeigen, nicht auf ``fund``.
            op.rename_table(old, new)
    for table, pairs in RENAMED_COLUMNS.items():
        if table in _tables():
            _rename(pairs, table)
    for table in REBUILT:
        if table in _tables():
            # ``recreate="always"``: ohne Auftrag baut Alembic die Tabelle
            # nicht um, und der alte Name der Bedingung bliebe stehen. Der
            # Nachbau kopiert ueber die Spaltennamen, und die stimmen jetzt.
            with op.batch_alter_table(
                table, copy_from=Base.metadata.tables[table], recreate="always"
            ):
                pass


def downgrade() -> None:
    """Nimmt die Namen nicht zurueck, und das mit Absicht.

    Jede Wanderung dieser Kette baut aus ``Base.metadata``, und die Modelle
    sprechen ab hier englisch. Wer die Tabellen hier zurueck auf Deutsch
    benennte, liesse jeden Schritt davor ins Leere greifen: ``fund`` steht
    dann in keiner Metadatentabelle mehr, und schon das Abraeumen der
    Baseline faende seine Tabellen nicht.

    Ein Rueckschritt unter diesen Punkt raeumt das Schema ab, statt es
    umzubenennen. Dafuer sind die englischen Namen die richtigen.
    """

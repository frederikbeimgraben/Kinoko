"""Zaehlt die Zeilen, deren Art der Katalog nicht kennt.

Der Fremdschluessel aus R4b greift erst, wenn jede dieser Spalten auf eine
Zeile in ``species`` zeigt oder leer ist. Dieses Werkzeug sagt vorher, ob das
so ist, ohne etwas zu aendern: es liest, es schreibt nie.

Aufruf gegen die Datenbank des Dienstes::

    uv run python -m tools.count_unknown_species /var/lib/pilze-app/pilze.sqlite

Ohne Pfad nimmt es die Datei aus ``PILZE_DB``. Steht die Tabelle ``species``
noch nicht, sagt es das und zaehlt nichts: dann ist die Wanderung noch nicht
gelaufen, und sie legt die Arten selbst an.
"""

import sqlite3
import sys
from pathlib import Path

from app.models import SPECIES_KEYS
from tools.count_orphans import database_path

SPECIES = "species"


def has_species(connection: sqlite3.Connection) -> bool:
    """Sagt, ob die Tabelle der Arten schon steht."""
    query = "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?"
    return bool(connection.execute(query, (SPECIES,)).fetchone()[0])


def unknown(connection: sqlite3.Connection, table: str, column: str) -> int:
    """Zaehlt in einer Spalte. Leere Werte zaehlen nicht: sie heissen unbekannt."""
    query = (
        f"SELECT count(*) FROM {table} t"  # noqa: S608 - Namen stehen in SPECIES_KEYS
        f" WHERE t.{column} IS NOT NULL"
        f" AND NOT EXISTS (SELECT 1 FROM {SPECIES} s WHERE s.slug = t.{column})"
    )
    return int(connection.execute(query).fetchone()[0])


def report(path: Path) -> int:
    """Schreibt eine Zeile je Spalte und gibt die Zahl der Verweise ins Leere zurueck."""
    with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as connection:
        if not has_species(connection):
            print(f"{SPECIES}: die Tabelle gibt es noch nicht, die Wanderung legt sie an.")
            return 0
        counts = {
            f"{table}.{column}": unknown(connection, table, column)
            for table, column in SPECIES_KEYS
        }
        species = int(connection.execute(f"SELECT count(*) FROM {SPECIES}").fetchone()[0])  # noqa: S608
    print(f"{SPECIES}: {species} Arten")
    for place, count in counts.items():
        print(f"{place}: {count} ohne Art im Katalog")
    return sum(counts.values())


def main() -> None:
    """Zaehlt und endet mit 1, wenn ein Verweis ins Leere im Weg steht."""
    total = report(database_path(sys.argv[1] if len(sys.argv) > 1 else None))
    if total > 0:
        print(f"\n{total} Zeilen ohne Art. Der Fremdschluessel greift erst, wenn sie weg sind.")
        raise SystemExit(1)
    print("\nKeine Verweise ins Leere. Der Fremdschluessel kann gesetzt werden.")


if __name__ == "__main__":
    main()

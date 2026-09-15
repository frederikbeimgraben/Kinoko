"""Katalogslug einer Art über den lateinischen Namen.

Der Kettenname bleibt intern (``boletus_edulis``), Manifest und Kachelordner
tragen den Katalogslug (``boletus-edulis``). ``--fetch`` holt den Katalog
einmal je Lauf und gibt die Zuordnung als JSON aus. ``--match`` ordnet
einen lateinischen Namen über die Umgebungsvariable ``PILZE_KATALOG`` zu,
ohne eigenen Netzzugriff.

Nutzung:
    python species_slug.py --fetch
    python species_slug.py --match "Boletus edulis"
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

import httpx

API = os.environ.get("PILZE_API", "http://127.0.0.1:8111/api")
CATALOG_ENV = "PILZE_KATALOG"
PAGE_SIZE = 40


def fetch_species(client: httpx.Client) -> list[dict[str, Any]]:
    """Liest den ganzen Artenkatalog, über alle Seiten."""
    found: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        params: dict[str, Any] = {"limit": PAGE_SIZE}
        if cursor:
            params["cursor"] = cursor
        answer = client.get("/species", params=params)
        answer.raise_for_status()
        body = answer.json()
        found += body["items"]
        cursor = body.get("nextCursor")
        if not cursor:
            return found


def latin_to_slug(species: list[dict[str, Any]]) -> dict[str, str]:
    """Bildet die Zuordnung vom kleingeschriebenen Latein zum Slug."""
    return {row["scientificName"].lower(): str(row["slug"]) for row in species}


def matching_slug(taxa: str, catalog: dict[str, str]) -> str | None:
    """Liefert den Slug zu einem der kommagetrennten lateinischen Namen."""
    for name in taxa.split(","):
        key = name.strip().lower()
        if key and key in catalog:
            return catalog[key]
    return None


def fetch_catalog() -> dict[str, str]:
    """Holt den Katalog einmal über die API."""
    with httpx.Client(base_url=API, timeout=30.0) as client:
        return latin_to_slug(fetch_species(client))


def read_catalog() -> dict[str, str]:
    """Liest den Katalog aus der Umgebungsvariable, sonst Abbruch."""
    raw = os.environ.get(CATALOG_ENV)
    if raw is None:
        raise SystemExit(f"{CATALOG_ENV} fehlt, der Katalog wurde nicht geholt")
    return dict(json.loads(raw))


def main(argv: list[str]) -> int:
    """Holt den Katalog einmal, oder ordnet einen lateinischen Namen zu."""
    if argv[:1] == ["--fetch"]:
        try:
            catalog = fetch_catalog()
        except httpx.HTTPError as error:
            print(f"Katalog nicht erreichbar: {error}", file=sys.stderr)
            return 1
        print(json.dumps(catalog))
        return 0
    if argv[:1] == ["--match"] and len(argv) > 1:
        slug = matching_slug(argv[1], read_catalog())
        if slug is None:
            return 1
        print(slug)
        return 0
    print("Nutzung: species_slug.py --fetch | --match <latein>", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

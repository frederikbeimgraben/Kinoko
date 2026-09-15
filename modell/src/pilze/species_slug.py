"""Look up a species slug in the catalogue by its Latin name.

The chain names its own runs (``boletus_edulis``), the catalogue names its
species with a slug from the Latin name (``boletus-edulis``). This module
reads the catalogue over the API and returns the slug for a Latin name, so
the chain can write its manifest and tile folder under the catalogue slug.

Usage:
    python species_slug.py "Boletus edulis"
"""

from __future__ import annotations

import os
import sys
from typing import Any

import httpx

API = os.environ.get("PILZE_API", "http://127.0.0.1:8111/api")
PAGE_SIZE = 40


def matching_slug(taxa: str, species: list[dict[str, Any]]) -> str | None:
    """Return the slug of the catalogue entry matching one of the Latin names."""
    wanted = {name.strip().lower() for name in taxa.split(",") if name.strip()}
    for row in species:
        if row["scientificName"].lower() in wanted:
            return str(row["slug"])
    return None


def fetch_species(client: httpx.Client) -> list[dict[str, Any]]:
    """Read the whole species catalogue, over all pages."""
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


def species_slug(taxa: str) -> str | None:
    """Return the catalogue slug for one of the given, comma-separated Latin names."""
    with httpx.Client(base_url=API, timeout=30.0) as client:
        return matching_slug(taxa, fetch_species(client))


def main() -> int:
    """Print the slug for the Latin names given on the command line."""
    slug = species_slug(sys.argv[1])
    if slug is None:
        return 1
    print(slug)
    return 0


if __name__ == "__main__":
    sys.exit(main())

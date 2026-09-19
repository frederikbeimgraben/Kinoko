"""Baut das Begriffs- und Farbvokabular aus den Profilen."""

from __future__ import annotations

import uuid
from typing import Any

from app.models import Term, new_id
from app.modules.catalog.importer.context import TermRegistry, tree_entry
from app.shared.enums import TermKind, TriggerGroup
from tools import catalog_vocabulary as vocab


def build_colour_vocabulary(profiles: dict[str, dict[str, Any]]) -> dict[str, str]:
    """Sammelt alle Name-Hex-Paare der Profile in einem Wörterbuch."""
    vocabulary: dict[str, str] = {}
    for profile in profiles.values():
        farben = profile.get("farben", {})
        for key, value in farben.items():
            if key == "verfaerbung":
                pairs = [
                    (c["name"], c["hex"]) for c in [*value.get("von", []), *value.get("nach", [])]
                ]
            else:
                pairs = [(c["name"], c["hex"]) for c in value]
            vocabulary.update(vocab.build_colour_vocabulary(pairs))
    return vocabulary


def _term_words(
    profiles: dict[str, dict[str, Any]],
) -> tuple[set[str], set[str], set[str], set[str]]:
    smell: set[str] = set()
    taste: set[str] = set()
    trees: set[str] = set()
    reagents: set[str] = set()
    for profile in profiles.values():
        smell.update(profile.get("geruch", {}).get("tags", []))
        taste.update(profile.get("geschmack", {}).get("tags", []))
        trees.update(profile.get("baeume", []))
        experience = profile.get("baeumeAusErfahrung")
        if experience:
            trees.update(experience.get("baeume", []))
        reagents.update(entry["reagenz"] for entry in profile.get("reagenzien", []))
    return smell, taste, trees, reagents


def build_terms(profiles: dict[str, dict[str, Any]]) -> TermRegistry:
    """Baut das gesamte Vokabular an Begriffen, in fester Reihenfolge."""
    smell, taste, trees, reagents = _term_words(profiles)
    rows: list[Term] = []
    ids: dict[tuple[str, str], uuid.UUID] = {}

    def add(kind: str, slug: str, name: str, group_key: str | None, position: int) -> None:
        new = new_id()
        ids[(kind, slug)] = new
        rows.append(
            Term(id=new, kind=kind, group_key=group_key, slug=slug, name=name, position=position)
        )

    for position, word in enumerate(sorted(smell)):
        name = vocab.lookup(vocab.SMELL_NAME, word, field="geruch", source="geruch.tags")
        add(TermKind.SMELL, vocab.slugify(word), name, None, position)
    for position, word in enumerate(sorted(taste)):
        name = vocab.lookup(vocab.TASTE_NAME, word, field="geschmack", source="geschmack.tags")
        add(TermKind.TASTE, vocab.slugify(word), name, None, position)
    for position, word in enumerate(sorted(trees)):
        slug, name = tree_entry(word)
        add(TermKind.TREE, slug, name, None, position)

    position = 0
    for slug, name in vocab.TRIGGER_MECHANICAL:
        add(TermKind.TRIGGER, slug, name, TriggerGroup.MECHANICAL, position)
        position += 1
    for word in sorted(reagents):
        slug = vocab.lookup(vocab.REAGENT_SLUG, word, field="reagenz", source="reagenzien")
        add(TermKind.TRIGGER, slug, vocab.REAGENT_NAME[slug], TriggerGroup.REAGENT, position)
        position += 1
    for slug, name in vocab.TRIGGER_ENVIRONMENT:
        add(TermKind.TRIGGER, slug, name, TriggerGroup.ENVIRONMENT, position)
        position += 1

    return TermRegistry(rows=rows, ids=ids)

"""Baut Merkmale, Quellen, Jahreszeiten und Verwechslungen einer Art."""

from __future__ import annotations

import uuid
from datetime import date
from urllib.parse import urlparse

from app.models import (
    SpeciesLookalike,
    SpeciesPartFeature,
    SpeciesSeason,
    SpeciesSource,
    SpeciesTerm,
    SpeciesTrait,
)
from app.modules.catalog.importer.context import BuildContext, tree_entry
from app.shared.enums import BodyPart, Phase, SourceScope, TermKind
from tools import catalog_vocabulary as vocab


def _both_phases(
    species_id: uuid.UUID, part: BodyPart, feature: str
) -> list[SpeciesPartFeature]:
    return [
        SpeciesPartFeature(species_id=species_id, part=part, feature=feature, phase=Phase.YOUNG),
        SpeciesPartFeature(species_id=species_id, part=part, feature=feature, phase=Phase.OLD),
    ]


def cap_feature_rows(ctx: BuildContext) -> list[SpeciesPartFeature]:
    """Baut die Hutmerkmale einer Art, für beide Phasen gleich."""
    rows: list[SpeciesPartFeature] = []
    for feature in ctx.profile.get("hutmerkmale", []):
        value = vocab.lookup(vocab.CAP_FEATURE, feature, field="hutmerkmale", source=ctx.stem)
        rows += _both_phases(ctx.species_id, BodyPart.CAP, value)
    return rows


def cap_margin_rows(ctx: BuildContext) -> list[SpeciesPartFeature]:
    """Baut den Hutrand einer Art, mit Wandel getrennt nach Phase."""
    hutrand = ctx.profile.get("hutrand")
    if not hutrand:
        return []
    von = [
        vocab.lookup(vocab.CAP_MARGIN, v, field="hutrand.von", source=ctx.stem)
        for v in hutrand.get("von", [])
    ]
    nach = hutrand.get("nach")
    if nach is None:
        rows: list[SpeciesPartFeature] = []
        for value in von:
            rows += _both_phases(ctx.species_id, BodyPart.CAP, value)
        return rows
    young = [
        SpeciesPartFeature(
            species_id=ctx.species_id, part=BodyPart.CAP, feature=v, phase=Phase.YOUNG
        )
        for v in von
    ]
    old = [
        SpeciesPartFeature(
            species_id=ctx.species_id,
            part=BodyPart.CAP,
            feature=vocab.lookup(vocab.CAP_MARGIN, v, field="hutrand.nach", source=ctx.stem),
            phase=Phase.OLD,
        )
        for v in nach
    ]
    return young + old


def stem_feature_rows(ctx: BuildContext) -> list[SpeciesPartFeature]:
    """Baut die Stielmerkmale einer Art, für beide Phasen gleich."""
    rows: list[SpeciesPartFeature] = []
    for feature in ctx.profile.get("stielmerkmale", []):
        value = vocab.lookup(vocab.STEM_FEATURE, feature, field="stielmerkmale", source=ctx.stem)
        rows += _both_phases(ctx.species_id, BodyPart.STEM, value)
    return rows


def trait_rows(ctx: BuildContext) -> list[SpeciesTrait]:
    """Baut die freien Merkmalstexte einer Art."""
    return [
        SpeciesTrait(
            species_id=ctx.species_id,
            key=vocab.lookup(vocab.TRAIT_KEY, key, field="merkmale", source=ctx.stem),
            body=text,
        )
        for key, text in ctx.profile.get("merkmale", {}).items()
    ]


def _hostname_title(url: str) -> str:
    host = urlparse(url).hostname or url
    return host.removeprefix("www.")


def source_rows(ctx: BuildContext) -> list[SpeciesSource]:
    """Baut die Quellen einer Art: das Profil, dann weitere Links."""
    quelle = ctx.profile["quelle"]
    checked_on = date.fromisoformat(quelle["geprueftAm"])
    rows = [
        SpeciesSource(
            species_id=ctx.species_id,
            position=0,
            scope=SourceScope.PROFILE,
            title=_hostname_title(quelle["url"]),
            url=quelle["url"],
            checked_on=checked_on,
        ),
    ]
    rows += [
        SpeciesSource(
            species_id=ctx.species_id,
            position=i + 1,
            scope=SourceScope.FURTHER,
            title=link["titel"],
            url=link["url"],
            checked_on=checked_on,
        )
        for i, link in enumerate(ctx.profile.get("links", []))
    ]
    return rows


def season_rows(ctx: BuildContext) -> list[SpeciesSeason]:
    """Baut die Jahreszeiten einer Art."""
    return [
        SpeciesSeason(
            species_id=ctx.species_id,
            season=vocab.lookup(vocab.SEASON, s, field="jahreszeiten", source=ctx.stem),
        )
        for s in ctx.profile.get("jahreszeiten", [])
    ]


def species_term_rows(ctx: BuildContext) -> list[SpeciesTerm]:
    """Baut die Begriffszuordnungen einer Art: Geruch, Geschmack, Bäume."""
    rows: list[SpeciesTerm] = []
    seen: set[uuid.UUID] = set()

    def add(term_id: uuid.UUID, *, experience: bool) -> None:
        if term_id in seen:
            return
        seen.add(term_id)
        rows.append(
            SpeciesTerm(species_id=ctx.species_id, term_id=term_id, from_experience=experience)
        )

    for tag in ctx.profile.get("geruch", {}).get("tags", []):
        add(ctx.terms.id_for(TermKind.SMELL, vocab.slugify(tag)), experience=False)
    for tag in ctx.profile.get("geschmack", {}).get("tags", []):
        add(ctx.terms.id_for(TermKind.TASTE, vocab.slugify(tag)), experience=False)
    for word in ctx.profile.get("baeume", []):
        slug, _ = tree_entry(word)
        add(ctx.terms.id_for(TermKind.TREE, slug), experience=False)
    experience_source = ctx.profile.get("baeumeAusErfahrung")
    if experience_source:
        for word in experience_source.get("baeume", []):
            slug, _ = tree_entry(word)
            add(ctx.terms.id_for(TermKind.TREE, slug), experience=True)
    return rows


def lookalike_rows(ctx: BuildContext) -> list[SpeciesLookalike]:
    """Baut die Verwechslungen einer Art, jedes Paar nur einmal."""
    rows: list[SpeciesLookalike] = []
    for entry in ctx.profile.get("verwechslungen", []):
        other_id = ctx.species_ids.get(entry["slug"])
        if other_id is None:
            ctx.report.skip("verwechslung_unbekannt")
            continue
        own_id = ctx.species_id
        first, second = (own_id, other_id) if own_id < other_id else (other_id, own_id)
        if (first, second) in ctx.seen_pairs:
            ctx.report.skip("verwechslung_doppelt")
            continue
        ctx.seen_pairs.add((first, second))
        own_diff = entry.get("eigenerUnterschied")
        other_diff = entry["unterschied"]
        difference_a, difference_b = (
            (own_diff, other_diff) if own_id < other_id else (other_diff, own_diff)
        )
        rows.append(
            SpeciesLookalike(
                species_a_id=first,
                species_b_id=second,
                difference_a=difference_a,
                difference_b=difference_b,
            ),
        )
    return rows

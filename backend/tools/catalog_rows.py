"""Baut ORM-Zeilen aus den TOML-Profilen und aus ``taxonomie.json``."""

from __future__ import annotations

import uuid
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from urllib.parse import urlparse

from app.models import (
    Species,
    SpeciesColour,
    SpeciesColourChange,
    SpeciesColourChangeTrigger,
    SpeciesColourRange,
    SpeciesLookalike,
    SpeciesMeasurement,
    SpeciesName,
    SpeciesPartFeature,
    SpeciesSeason,
    SpeciesSource,
    SpeciesTerm,
    SpeciesTrait,
    Taxon,
    Term,
    new_id,
)
from app.shared.enums import (
    BodyPart,
    ColourMode,
    Dimension,
    NameKind,
    Phase,
    SourceScope,
    TaxonRank,
    TermKind,
    TriggerGroup,
)
from tools import catalog_vocabulary as vocab

RANK_ORDER: dict[str, int] = {
    TaxonRank.DIVISION: 0,
    TaxonRank.CLASS: 1,
    TaxonRank.ORDER: 2,
    TaxonRank.FAMILY: 3,
    TaxonRank.GENUS: 4,
}

MEASUREMENTS: dict[str, tuple[BodyPart, Dimension]] = {
    "hutBreiteCm": (BodyPart.CAP, Dimension.WIDTH),
    "stielLaengeCm": (BodyPart.STEM, Dimension.LENGTH),
    "stielDickeCm": (BodyPart.STEM, Dimension.THICKNESS),
    "sporenLaengeUm": (BodyPart.SPORE, Dimension.LENGTH),
    "sporenBreiteUm": (BodyPart.SPORE, Dimension.WIDTH),
    "fruchtkoerperBreiteCm": (BodyPart.FRUITBODY, Dimension.WIDTH),
    "fruchtkoerperHoeheCm": (BodyPart.FRUITBODY, Dimension.HEIGHT),
}

COLOUR_PARTS: dict[str, BodyPart] = {
    "hut": BodyPart.CAP,
    "stiel": BodyPart.STEM,
    "fleisch": BodyPart.FLESH,
    "sporenpulver": BodyPart.SPORE_PRINT,
}

HYMENIUM_BODY_PARTS: dict[str, BodyPart] = {
    "gills": BodyPart.GILLS,
    "tubes": BodyPart.TUBES,
    "pores": BodyPart.PORES,
}


@dataclass(slots=True)
class Report:
    """Zählt geschriebene Zeilen und übersprungene Fälle."""

    counts: Counter[str] = field(default_factory=Counter)
    skipped: Counter[str] = field(default_factory=Counter)

    def skip(self, key: str) -> None:
        """Zählt einen übersprungenen Fall."""
        self.skipped[key] += 1


@dataclass(slots=True)
class TermRegistry:
    """Die Begriffe des Katalogs mit ihren Kennungen."""

    rows: list[Term]
    ids: dict[tuple[str, str], uuid.UUID]

    def id_for(self, kind: str, slug: str) -> uuid.UUID:
        """Liefert die Kennung eines Begriffs."""
        return self.ids[(kind, slug)]


@dataclass(slots=True)
class BuildContext:
    """Alles, was ein Profil braucht, um seine Zeilen zu bauen."""

    stem: str
    profile: dict[str, Any]
    species_id: uuid.UUID
    slug: str
    genus_ids: dict[tuple[str, str], uuid.UUID]
    terms: TermRegistry
    colours: dict[str, str]
    species_ids: dict[str, uuid.UUID]
    report: Report
    seen_pairs: set[tuple[uuid.UUID, uuid.UUID]]


def _optional_lookup(
    table: dict[str, str], value: str | None, field_name: str, source: str
) -> str | None:
    if value is None:
        return None
    return vocab.lookup(table, value, field=field_name, source=source)


def _tree_entry(word: str) -> tuple[str, str]:
    try:
        return vocab.TREE[word]
    except KeyError as error:
        raise vocab.UnknownVocabulary(f"Unbekannter Baum '{word}'.") from error


def load_taxonomy(
    entries: list[dict[str, Any]],
) -> tuple[list[Taxon], dict[str, uuid.UUID], dict[tuple[str, str], uuid.UUID]]:
    """Baut die Taxon-Zeilen, die Kennung je JSON-Slug und die Gattungen."""
    ids = {entry["slug"]: new_id() for entry in entries}
    rows: list[Taxon] = []
    genus_ids: dict[tuple[str, str], uuid.UUID] = {}
    for entry in entries:
        rank = vocab.lookup(
            vocab.TAXON_RANK, entry["rang"], field="rang", source=f"taxonomie.json:{entry['slug']}"
        )
        slug = vocab.slugify(entry["lateinisch"])
        own_id = ids[entry["slug"]]
        parent = entry.get("elter")
        rows.append(
            Taxon(
                id=own_id,
                rank=rank,
                slug=slug,
                name=entry["name"],
                latin_name=entry["lateinisch"],
                parent_id=ids.get(parent) if parent else None,
            ),
        )
        if rank == TaxonRank.GENUS:
            genus_ids[(TaxonRank.GENUS, slug)] = own_id
    rows.sort(key=lambda row: RANK_ORDER[row.rank])
    return rows, ids, genus_ids


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
        add(TermKind.SMELL, vocab.slugify(word), word, None, position)
    for position, word in enumerate(sorted(taste)):
        add(TermKind.TASTE, vocab.slugify(word), word, None, position)
    for position, word in enumerate(sorted(trees)):
        slug, name = _tree_entry(word)
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


def _taxon_id(ctx: BuildContext) -> uuid.UUID | None:
    genus_slug = vocab.slugify(ctx.profile["lateinisch"].split()[0])
    found = ctx.genus_ids.get((TaxonRank.GENUS, genus_slug))
    if found is None:
        ctx.report.skip("species_ohne_gattung")
    return found


def _species_row(ctx: BuildContext, taxon_id: uuid.UUID | None) -> Species:
    profile = ctx.profile
    schutz = profile["schutz"]
    period: dict[str, Any] = profile.get("zeitraum") or {}
    smell: dict[str, Any] = profile.get("geruch", {})
    taste: dict[str, Any] = profile.get("geschmack", {})
    hymenium: dict[str, Any] = profile.get("fruchtschicht") or {}
    shape: dict[str, Any] = profile.get("hutform") or {}
    return Species(
        id=ctx.species_id,
        slug=ctx.slug,
        name=profile["name"],
        latin_name=profile["lateinisch"],
        taxon_id=taxon_id,
        group_key=vocab.lookup(vocab.GROUP, profile["gruppe"], field="gruppe", source=ctx.stem),
        edibility=vocab.lookup(
            vocab.EDIBILITY, profile["speisewert"], field="speisewert", source=ctx.stem
        ),
        marketable=profile.get("marktfaehig", False),
        forecast_enabled=False,
        frequency=_optional_lookup(
            vocab.FREQUENCY, profile.get("haeufigkeit"), "haeufigkeit", ctx.stem
        ),
        red_list=_optional_lookup(
            vocab.RED_LIST, profile.get("gefaehrdung"), "gefaehrdung", ctx.stem
        ),
        description=None,
        edibility_note=profile.get("speisewertHinweis"),
        protection=vocab.lookup(
            vocab.PROTECTION, schutz["status"], field="schutz.status", source=ctx.stem
        ),
        protection_note=profile.get("schutzHinweis"),
        period_start_month=period.get("vonMonat"),
        period_end_month=period.get("bisMonat"),
        period_peak_month=period.get("spitzeMonat"),
        smell_text=smell.get("text"),
        taste_text=taste.get("text"),
        hymenium_type=_optional_lookup(
            vocab.HYMENIUM_TYPE, hymenium.get("art"), "fruchtschicht.art", ctx.stem
        ),
        gill_attachment=_optional_lookup(
            vocab.GILL_ATTACHMENT, hymenium.get("ansatz"), "fruchtschicht.ansatz", ctx.stem
        ),
        gill_spacing=_optional_lookup(
            vocab.GILL_SPACING, hymenium.get("stand"), "fruchtschicht.stand", ctx.stem
        ),
        gill_edge=_optional_lookup(
            vocab.GILL_EDGE, hymenium.get("schneide"), "fruchtschicht.schneide", ctx.stem
        ),
        cap_shape_young=_optional_lookup(
            vocab.CAP_SHAPE, shape.get("von"), "hutform.von", ctx.stem
        ),
        cap_shape_old=_optional_lookup(
            vocab.CAP_SHAPE, shape.get("nach"), "hutform.nach", ctx.stem
        ),
    )


def _name_rows(ctx: BuildContext) -> list[SpeciesName]:
    names = [(n, NameKind.COMMON) for n in ctx.profile.get("weitereNamen", [])]
    names += [(n, NameKind.SYNONYM) for n in ctx.profile.get("synonyme", [])]
    return [
        SpeciesName(species_id=ctx.species_id, position=i, name=name, kind=kind)
        for i, (name, kind) in enumerate(names)
    ]


def _measurement_rows(ctx: BuildContext) -> list[SpeciesMeasurement]:
    rows: list[SpeciesMeasurement] = []
    for key, span in ctx.profile.get("masse", {}).items():
        target = MEASUREMENTS.get(key)
        if target is None:
            ctx.report.skip("measurement_ohne_koerperteil")
            continue
        part, dimension = target
        rows.append(
            SpeciesMeasurement(
                species_id=ctx.species_id,
                part=part,
                dimension=dimension,
                low=span["von"],
                high=span["bis"],
                rare_low=span.get("seltenVon"),
                rare_high=span.get("seltenBis"),
                unit=vocab.lookup(vocab.UNIT, span["einheit"], field="einheit", source=ctx.stem),
            ),
        )
    return rows


def _colour_rows(
    ctx: BuildContext, hymenium_type: str | None
) -> tuple[list[SpeciesColourRange], list[SpeciesColour]]:
    ranges: list[SpeciesColourRange] = []
    colours: list[SpeciesColour] = []
    for key, entries in ctx.profile.get("farben", {}).items():
        if key == "verfaerbung" or not entries:
            continue
        if key == "sporenlager":
            part = HYMENIUM_BODY_PARTS.get(hymenium_type or "")
            if part is None:
                ctx.report.skip("colour_ohne_koerperteil")
                continue
        else:
            part = COLOUR_PARTS[key]
        mode = ColourMode.SINGLE if len(entries) == 1 else ColourMode.DISTINCT
        ranges.append(SpeciesColourRange(species_id=ctx.species_id, part=part, mode=mode))
        colours += [
            SpeciesColour(
                species_id=ctx.species_id, part=part, position=i, name=e["name"], hex=e["hex"]
            )
            for i, e in enumerate(entries)
        ]
    return ranges, colours


def _mechanical_change_rows(
    ctx: BuildContext,
) -> tuple[list[SpeciesColourChange], list[SpeciesColourChangeTrigger]]:
    change = ctx.profile.get("farben", {}).get("verfaerbung")
    if not change:
        return [], []
    speed = _optional_lookup(vocab.SPEED, change.get("dauer"), "farben.verfaerbung.dauer", ctx.stem)
    trigger_id = ctx.terms.id_for(TermKind.TRIGGER, vocab.CUT_TRIGGER_SLUG)
    changes: list[SpeciesColourChange] = []
    triggers: list[SpeciesColourChangeTrigger] = []
    for position, colour in enumerate(change.get("nach", [])):
        changes.append(
            SpeciesColourChange(
                species_id=ctx.species_id,
                position=position,
                part=BodyPart.FLESH,
                from_name=None,
                from_hex=None,
                to_name=colour["name"],
                to_hex=colour["hex"],
                speed=speed,
            ),
        )
        triggers.append(
            SpeciesColourChangeTrigger(
                species_id=ctx.species_id, position=position, term_id=trigger_id
            )
        )
    return changes, triggers


def _reagent_change_rows(
    ctx: BuildContext, position_start: int
) -> tuple[list[SpeciesColourChange], list[SpeciesColourChangeTrigger]]:
    changes: list[SpeciesColourChange] = []
    triggers: list[SpeciesColourChangeTrigger] = []
    position = position_start
    for entry in ctx.profile.get("reagenzien", []):
        found = vocab.find_colour(entry["reaktion"], ctx.colours)
        if found is None:
            ctx.report.skip("reagenz_ohne_zielfarbe")
            continue
        name, hex_code = found
        slug = vocab.lookup(vocab.REAGENT_SLUG, entry["reagenz"], field="reagenz", source=ctx.stem)
        trigger_id = ctx.terms.id_for(TermKind.TRIGGER, slug)
        changes.append(
            SpeciesColourChange(
                species_id=ctx.species_id,
                position=position,
                part=BodyPart.FLESH,
                from_name=None,
                from_hex=None,
                to_name=name,
                to_hex=hex_code,
                speed=None,
            ),
        )
        triggers.append(
            SpeciesColourChangeTrigger(
                species_id=ctx.species_id, position=position, term_id=trigger_id
            )
        )
        position += 1
    return changes, triggers


def _colour_change_rows(
    ctx: BuildContext,
) -> tuple[list[SpeciesColourChange], list[SpeciesColourChangeTrigger]]:
    mech_changes, mech_triggers = _mechanical_change_rows(ctx)
    reagent_changes, reagent_triggers = _reagent_change_rows(ctx, len(mech_changes))
    return mech_changes + reagent_changes, mech_triggers + reagent_triggers


def _both_phases(species_id: uuid.UUID, part: BodyPart, feature: str) -> list[SpeciesPartFeature]:
    return [
        SpeciesPartFeature(species_id=species_id, part=part, feature=feature, phase=Phase.YOUNG),
        SpeciesPartFeature(species_id=species_id, part=part, feature=feature, phase=Phase.OLD),
    ]


def _cap_feature_rows(ctx: BuildContext) -> list[SpeciesPartFeature]:
    rows: list[SpeciesPartFeature] = []
    for feature in ctx.profile.get("hutmerkmale", []):
        value = vocab.lookup(vocab.CAP_FEATURE, feature, field="hutmerkmale", source=ctx.stem)
        rows += _both_phases(ctx.species_id, BodyPart.CAP, value)
    return rows


def _cap_margin_rows(ctx: BuildContext) -> list[SpeciesPartFeature]:
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


def _stem_feature_rows(ctx: BuildContext) -> list[SpeciesPartFeature]:
    rows: list[SpeciesPartFeature] = []
    for feature in ctx.profile.get("stielmerkmale", []):
        value = vocab.lookup(vocab.STEM_FEATURE, feature, field="stielmerkmale", source=ctx.stem)
        rows += _both_phases(ctx.species_id, BodyPart.STEM, value)
    return rows


def _trait_rows(ctx: BuildContext) -> list[SpeciesTrait]:
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


def _source_rows(ctx: BuildContext) -> list[SpeciesSource]:
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


def _season_rows(ctx: BuildContext) -> list[SpeciesSeason]:
    return [
        SpeciesSeason(
            species_id=ctx.species_id,
            season=vocab.lookup(vocab.SEASON, s, field="jahreszeiten", source=ctx.stem),
        )
        for s in ctx.profile.get("jahreszeiten", [])
    ]


def _species_term_rows(ctx: BuildContext) -> list[SpeciesTerm]:
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
        slug, _ = _tree_entry(word)
        add(ctx.terms.id_for(TermKind.TREE, slug), experience=False)
    experience_source = ctx.profile.get("baeumeAusErfahrung")
    if experience_source:
        for word in experience_source.get("baeume", []):
            slug, _ = _tree_entry(word)
            add(ctx.terms.id_for(TermKind.TREE, slug), experience=True)
    return rows


def _lookalike_rows(ctx: BuildContext) -> list[SpeciesLookalike]:
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


def build_species(ctx: BuildContext) -> tuple[Species, list[object], Counter[str]]:
    """Baut die Artzeile, alle Kindzeilen und ihre Zählung aus einem Profil."""
    taxon_id = _taxon_id(ctx)
    row = _species_row(ctx, taxon_id)
    names = _name_rows(ctx)
    measurements = _measurement_rows(ctx)
    ranges, colours = _colour_rows(ctx, row.hymenium_type)
    changes, triggers = _colour_change_rows(ctx)
    part_features = _cap_feature_rows(ctx) + _cap_margin_rows(ctx) + _stem_feature_rows(ctx)
    traits = _trait_rows(ctx)
    sources = _source_rows(ctx)
    seasons = _season_rows(ctx)
    species_terms = _species_term_rows(ctx)
    lookalikes = _lookalike_rows(ctx)
    children: list[object] = [
        *names,
        *measurements,
        *ranges,
        *colours,
        *changes,
        *triggers,
        *part_features,
        *traits,
        *sources,
        *seasons,
        *species_terms,
        *lookalikes,
    ]
    counts = Counter(
        {
            "species_name": len(names),
            "species_measurement": len(measurements),
            "species_colour_range": len(ranges),
            "species_colour": len(colours),
            "species_colour_change": len(changes),
            "species_colour_change_trigger": len(triggers),
            "species_part_feature": len(part_features),
            "species_trait": len(traits),
            "species_source": len(sources),
            "species_season": len(seasons),
            "species_term": len(species_terms),
            "species_lookalike": len(lookalikes),
        },
    )
    return row, children, counts

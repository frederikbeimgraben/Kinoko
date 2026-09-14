"""Baut die Grundfelder einer Art aus ihrem Profil."""

from __future__ import annotations

import uuid
from typing import Any

from app.models import Species, SpeciesName
from app.modules.catalog.importer.context import BuildContext, optional_lookup
from app.shared.enums import BodyPart, Dimension, NameKind, TaxonRank
from tools import catalog_vocabulary as vocab

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


def find_taxon_id(ctx: BuildContext) -> uuid.UUID | None:
    """Findet die Gattung einer Art, oder meldet das Fehlen."""
    genus_slug = vocab.slugify(ctx.profile["lateinisch"].split()[0])
    found = ctx.genus_ids.get((TaxonRank.GENUS, genus_slug))
    if found is None:
        ctx.report.skip("species_ohne_gattung")
    return found


def species_row(ctx: BuildContext, taxon_id: uuid.UUID | None) -> Species:
    """Baut die Artzeile aus den Grundfeldern des Profils."""
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
        frequency=optional_lookup(
            vocab.FREQUENCY, profile.get("haeufigkeit"), "haeufigkeit", ctx.stem
        ),
        red_list=optional_lookup(
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
        hymenium_type=optional_lookup(
            vocab.HYMENIUM_TYPE, hymenium.get("art"), "fruchtschicht.art", ctx.stem
        ),
        gill_attachment=optional_lookup(
            vocab.GILL_ATTACHMENT, hymenium.get("ansatz"), "fruchtschicht.ansatz", ctx.stem
        ),
        gill_spacing=optional_lookup(
            vocab.GILL_SPACING, hymenium.get("stand"), "fruchtschicht.stand", ctx.stem
        ),
        gill_edge=optional_lookup(
            vocab.GILL_EDGE, hymenium.get("schneide"), "fruchtschicht.schneide", ctx.stem
        ),
        cap_shape_young=optional_lookup(vocab.CAP_SHAPE, shape.get("von"), "hutform.von", ctx.stem),
        cap_shape_old=optional_lookup(vocab.CAP_SHAPE, shape.get("nach"), "hutform.nach", ctx.stem),
    )


def name_rows(ctx: BuildContext) -> list[SpeciesName]:
    """Baut die weiteren Namen und Synonyme einer Art."""
    names = [(n, NameKind.COMMON) for n in ctx.profile.get("weitereNamen", [])]
    names += [(n, NameKind.SYNONYM) for n in ctx.profile.get("synonyme", [])]
    return [
        SpeciesName(species_id=ctx.species_id, position=i, name=name, kind=kind)
        for i, (name, kind) in enumerate(names)
    ]

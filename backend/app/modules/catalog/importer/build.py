"""Baut die vollständige Artzeile mit allen Kindzeilen aus einem Profil."""

from __future__ import annotations

from collections import Counter

from app.models import Species
from app.modules.catalog.importer import children, colours, fields
from app.modules.catalog.importer.context import BuildContext


def build_species(ctx: BuildContext) -> tuple[Species, list[object], Counter[str]]:
    """Baut die Artzeile, alle Kindzeilen und ihre Zählung aus einem Profil."""
    taxon_id = fields.find_taxon_id(ctx)
    row = fields.species_row(ctx, taxon_id)
    names = fields.name_rows(ctx)
    measurements = colours.measurement_rows(ctx)
    ranges, species_colours = colours.colour_rows(ctx, row.hymenium_type)
    changes, triggers = colours.colour_change_rows(ctx)
    part_features = (
        children.cap_feature_rows(ctx)
        + children.cap_margin_rows(ctx)
        + children.stem_feature_rows(ctx)
    )
    traits = children.trait_rows(ctx)
    sources = children.source_rows(ctx)
    seasons = children.season_rows(ctx)
    species_terms = children.species_term_rows(ctx)
    lookalikes = children.lookalike_rows(ctx)
    all_children: list[object] = [
        *names,
        *measurements,
        *ranges,
        *species_colours,
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
            "species_colour": len(species_colours),
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
    return row, all_children, counts

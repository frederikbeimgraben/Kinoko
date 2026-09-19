"""Tests des Katalogimports: Baulogik und die CLI darüber."""

from __future__ import annotations

import uuid
from enum import StrEnum
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pytest
from sqlalchemy import func, select

from app.models import (
    Species,
    SpeciesColour,
    SpeciesColourChange,
    SpeciesColourChangeTrigger,
    SpeciesLookalike,
    SpeciesMeasurement,
    SpeciesPartFeature,
    Taxon,
)
from app.modules.catalog import importer
from app.shared.enums import (
    BodyPart,
    CapFeature,
    CapMargin,
    CapShape,
    Dimension,
    Edibility,
    Frequency,
    GillAttachment,
    GillEdge,
    GillSpacing,
    Group,
    HymeniumType,
    Phase,
    Protection,
    RedListStatus,
    Season,
    Speed,
    StemFeature,
    TaxonRank,
    TermKind,
    TraitKey,
    Unit,
)
from tools import catalog_vocabulary as vocab
from tools import import_catalog

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

ENUM_TABLES = [
    (vocab.GROUP, Group),
    (vocab.EDIBILITY, Edibility),
    (vocab.PROTECTION, Protection),
    (vocab.FREQUENCY, Frequency),
    (vocab.RED_LIST, RedListStatus),
    (vocab.SEASON, Season),
    (vocab.TAXON_RANK, TaxonRank),
    (vocab.UNIT, Unit),
    (vocab.SPEED, Speed),
    (vocab.HYMENIUM_TYPE, HymeniumType),
    (vocab.GILL_ATTACHMENT, GillAttachment),
    (vocab.GILL_SPACING, GillSpacing),
    (vocab.GILL_EDGE, GillEdge),
    (vocab.CAP_SHAPE, CapShape),
    (vocab.CAP_FEATURE, CapFeature),
    (vocab.CAP_MARGIN, CapMargin),
    (vocab.STEM_FEATURE, StemFeature),
    (vocab.TRAIT_KEY, TraitKey),
]


def species_file_count() -> int:
    """Zählt die TOML-Profile, unabhängig vom Datenstand."""
    return len(list(importer.SPECIES_DIR.glob("*.toml")))


def _profile(**overrides: Any) -> dict[str, Any]:  # noqa: ANN401
    base: dict[str, Any] = {
        "name": "Testpilz",
        "lateinisch": "Testus fungus",
        "gruppe": "roehrling",
        "speisewert": "essbar",
        "jahreszeiten": [],
        "baeume": [],
        "schutz": {"status": "keiner", "quelle": "Test"},
        "quelle": {"url": "https://example.test/a", "geprueftAm": "2026-01-01"},
        "links": [],
        "merkmale": {},
    }
    base.update(overrides)
    return base


def _context(profile: dict[str, Any], **overrides: Any) -> importer.BuildContext:  # noqa: ANN401
    defaults: dict[str, Any] = {
        "stem": "testpilz",
        "profile": profile,
        "species_id": uuid.uuid4(),
        "slug": "testus-fungus",
        "genus_ids": {},
        "terms": importer.TermRegistry(rows=[], ids={}),
        "colours": {},
        "species_ids": {},
        "report": importer.Report(),
        "seen_pairs": set(),
    }
    defaults.update(overrides)
    return importer.BuildContext(**defaults)


@pytest.mark.parametrize(("table", "enum_cls"), ENUM_TABLES)
def test_vocabulary_values_are_known_enum_members(
    table: dict[str, str], enum_cls: type[StrEnum]
) -> None:
    known = {member.value for member in enum_cls}
    for value in table.values():
        assert value in known


def test_unknown_value_is_reported() -> None:
    with pytest.raises(vocab.UnknownVocabulary):
        vocab.lookup(vocab.EDIBILITY, "nichtvorhanden", field="speisewert", source="test")


def test_unknown_tree_is_reported() -> None:
    profiles = {"x": _profile(baeume=["nichtvorhandenerbaum"])}
    with pytest.raises(vocab.UnknownVocabulary):
        importer.build_terms(profiles)


def test_unknown_smell_is_reported() -> None:
    profiles = {"x": _profile(geruch={"tags": ["nichtvorhandenergeruch"]})}
    with pytest.raises(vocab.UnknownVocabulary):
        importer.build_terms(profiles)


def test_unknown_taste_is_reported() -> None:
    profiles = {"x": _profile(geschmack={"tags": ["nichtvorhandenergeschmack"]})}
    with pytest.raises(vocab.UnknownVocabulary):
        importer.build_terms(profiles)


def test_smell_and_taste_terms_get_real_names_with_umlauts() -> None:
    profiles = {
        "x": _profile(
            geruch={"tags": ["unauffaellig", "wuerzig"]},
            geschmack={"tags": ["suesslich"]},
        )
    }
    registry = importer.build_terms(profiles)
    names = {(row.kind, row.slug): row.name for row in registry.rows}
    assert names[(TermKind.SMELL, "unauffaellig")] == "Unauffällig"
    assert names[(TermKind.SMELL, "wuerzig")] == "Würzig"
    assert names[(TermKind.TASTE, "suesslich")] == "Süßlich"


def test_slugify_handles_umlauts_and_spaces() -> None:
    assert vocab.slugify("Boletus edulis") == "boletus-edulis"
    assert vocab.slugify("Kastanienbraune Wurzeltrüffel") == "kastanienbraune-wurzeltrueffel"


def test_find_colour_picks_last_known_word() -> None:
    vocabulary = {"ocker": "#c8963c", "grau": "#8a8a8a", "grün": "#4f8a3a"}
    found = vocab.find_colour("Fleisch ocker mit graugrüner Schattierung.", vocabulary)
    assert found == ("grün", "#4f8a3a")


def test_find_colour_returns_none_without_match() -> None:
    assert vocab.find_colour("Ohne Reaktion.", {"braun": "#7a5230"}) is None


def test_unknown_genus_is_counted() -> None:
    ctx = _context(_profile())
    row, _children, _counts = importer.build_species(ctx)
    assert row.taxon_id is None
    assert ctx.report.skipped["species_ohne_gattung"] == 1


def test_forecast_enabled_follows_karte_field() -> None:
    ctx = _context(_profile(karte="boletus_edulis"))
    row, _children, _counts = importer.build_species(ctx)
    assert row.forecast_enabled is True


def test_forecast_enabled_false_without_karte_field() -> None:
    ctx = _context(_profile())
    row, _children, _counts = importer.build_species(ctx)
    assert row.forecast_enabled is False


def test_unknown_lookalike_is_skipped_and_counted() -> None:
    profile = _profile(verwechslungen=[{"slug": "unbekannt", "unterschied": "x"}])
    ctx = _context(profile)
    _row, _children, counts = importer.build_species(ctx)
    assert counts["species_lookalike"] == 0
    assert ctx.report.skipped["verwechslung_unbekannt"] == 1


def test_sporenlager_without_bodypart_is_skipped() -> None:
    profile = _profile(
        fruchtschicht={"art": "leisten"},
        farben={"sporenlager": [{"name": "gelb", "hex": "#e8c33a"}]},
    )
    ctx = _context(profile)
    _row, _children, counts = importer.build_species(ctx)
    assert counts["species_colour"] == 0
    assert ctx.report.skipped["colour_ohne_koerperteil"] == 1


def test_reagent_without_colour_word_is_skipped() -> None:
    profile = _profile(reagenzien=[{"reagenz": "koh", "reaktion": "Ohne Reaktion."}])
    ctx = _context(profile)
    _row, _children, counts = importer.build_species(ctx)
    assert counts["species_colour_change"] == 0
    assert ctx.report.skipped["reagenz_ohne_zielfarbe"] == 1


def test_spore_and_fruitbody_measurements_land_in_the_table() -> None:
    profile = _profile(
        masse={
            "sporenLaengeUm": {"von": 4.0, "bis": 6.0, "einheit": "um"},
            "sporenBreiteUm": {"von": 2.0, "bis": 3.0, "einheit": "um"},
            "fruchtkoerperBreiteCm": {"von": 5.0, "bis": 9.0, "einheit": "cm"},
            "fruchtkoerperHoeheCm": {"von": 6.0, "bis": 12.0, "einheit": "cm"},
        },
    )
    ctx = _context(profile)
    _row, children, counts = importer.build_species(ctx)
    assert counts["species_measurement"] == 4
    assert "measurement_ohne_koerperteil" not in ctx.report.skipped
    found = {(row.part, row.dimension) for row in children if isinstance(row, SpeciesMeasurement)}
    assert found == {
        (BodyPart.SPORE, Dimension.LENGTH),
        (BodyPart.SPORE, Dimension.WIDTH),
        (BodyPart.FRUITBODY, Dimension.WIDTH),
        (BodyPart.FRUITBODY, Dimension.HEIGHT),
    }


def test_an_unknown_measurement_is_counted() -> None:
    profile = _profile(masse={"wurzelTiefeCm": {"von": 1.0, "bis": 2.0, "einheit": "cm"}})
    ctx = _context(profile)
    _row, _children, counts = importer.build_species(ctx)
    assert counts["species_measurement"] == 0
    assert ctx.report.skipped["measurement_ohne_koerperteil"] == 1


def test_duplicate_species_term_is_collapsed() -> None:
    profile = _profile(geruch={"tags": ["pilzig", "pilzig"]})
    terms = importer.TermRegistry(rows=[], ids={(TermKind.SMELL, "pilzig"): uuid.uuid4()})
    ctx = _context(profile, terms=terms)
    _row, _children, counts = importer.build_species(ctx)
    assert counts["species_term"] == 1


def test_duplicate_lookalike_pair_is_skipped_and_counted() -> None:
    other_id = uuid.uuid4()
    profile = _profile(
        verwechslungen=[
            {"slug": "andere", "unterschied": "a"},
            {"slug": "andere", "unterschied": "b"},
        ],
    )
    ctx = _context(profile, species_ids={"andere": other_id})
    _row, _children, counts = importer.build_species(ctx)
    assert counts["species_lookalike"] == 1
    assert ctx.report.skipped["verwechslung_doppelt"] == 1


def test_cap_margin_without_change_applies_both_phases() -> None:
    profile = _profile(hutrand={"von": ["eingerollt"]})
    ctx = _context(profile)
    _row, children, _counts = importer.build_species(ctx)
    features = [c for c in children if isinstance(c, SpeciesPartFeature)]
    phases = {f.phase for f in features}
    assert phases == {Phase.YOUNG, Phase.OLD}
    assert all(f.feature == CapMargin.INROLLED for f in features)


def test_cap_margin_with_change_splits_by_phase() -> None:
    profile = _profile(hutrand={"von": ["eingerollt"], "nach": ["wellig"]})
    ctx = _context(profile)
    _row, children, _counts = importer.build_species(ctx)
    found = {(f.part, f.feature, f.phase) for f in children if isinstance(f, SpeciesPartFeature)}
    assert (BodyPart.CAP, CapMargin.INROLLED, Phase.YOUNG) in found
    assert (BodyPart.CAP, CapMargin.WAVY, Phase.OLD) in found


async def test_import_writes_every_species(session: AsyncSession) -> None:
    report = importer.Report()
    await importer.import_all(session, report)
    total = (await session.execute(select(func.count()).select_from(Species))).scalar_one()
    assert total == species_file_count()
    assert report.counts["species"] == species_file_count()


async def test_boletus_edulis_details(session: AsyncSession) -> None:
    report = importer.Report()
    await importer.import_all(session, report)
    row = (
        await session.execute(select(Species).where(Species.slug == "boletus-edulis"))
    ).scalar_one()

    assert row.edibility == Edibility.EDIBLE
    assert row.group_key == Group.BOLETE
    assert row.protection == Protection.PERSONAL_USE
    assert row.taxon_id is not None

    genus = (await session.execute(select(Taxon).where(Taxon.id == row.taxon_id))).scalar_one()
    assert genus.slug == "boletus"
    assert genus.rank == TaxonRank.GENUS

    cap_colours = (
        (
            await session.execute(
                select(SpeciesColour).where(
                    SpeciesColour.species_id == row.id, SpeciesColour.part == BodyPart.CAP
                ),
            )
        )
        .scalars()
        .all()
    )
    assert {c.name for c in cap_colours} >= {"weiß", "braun"}

    measurements = (
        (
            await session.execute(
                select(SpeciesMeasurement).where(SpeciesMeasurement.species_id == row.id)
            )
        )
        .scalars()
        .all()
    )
    assert {(m.part, m.dimension) for m in measurements} == {
        (BodyPart.CAP, Dimension.WIDTH),
        (BodyPart.SPORE, Dimension.LENGTH),
        (BodyPart.SPORE, Dimension.WIDTH),
    }

    changes = (
        (
            await session.execute(
                select(SpeciesColourChange).where(SpeciesColourChange.species_id == row.id),
            )
        )
        .scalars()
        .all()
    )
    assert len(changes) == 2

    triggers = (
        (
            await session.execute(
                select(SpeciesColourChangeTrigger).where(
                    SpeciesColourChangeTrigger.species_id == row.id
                ),
            )
        )
        .scalars()
        .all()
    )
    assert len(triggers) == 2

    lookalikes = (
        (
            await session.execute(
                select(SpeciesLookalike).where(
                    (SpeciesLookalike.species_a_id == row.id)
                    | (SpeciesLookalike.species_b_id == row.id),
                ),
            )
        )
        .scalars()
        .all()
    )
    assert len(lookalikes) >= 1


async def test_second_run_does_not_duplicate(session: AsyncSession) -> None:
    await importer.import_all(session, importer.Report())
    first = (await session.execute(select(func.count()).select_from(Species))).scalar_one()

    await importer.import_all(session, importer.Report())
    second = (await session.execute(select(func.count()).select_from(Species))).scalar_one()

    assert first == second == species_file_count()

    colours = (await session.execute(select(func.count()).select_from(SpeciesColour))).scalar_one()
    lookalikes = (
        await session.execute(select(func.count()).select_from(SpeciesLookalike))
    ).scalar_one()
    assert colours > 0
    assert lookalikes > 0


async def test_run_creates_schema_and_imports(tmp_path: Path) -> None:
    db_path = tmp_path / "catalog.sqlite"
    report = await import_catalog.run(f"sqlite+aiosqlite:///{db_path}")
    assert report.counts["species"] == species_file_count()


def test_parse_args_defaults_to_none() -> None:
    assert import_catalog.parse_args([]).db is None
    url = "sqlite+aiosqlite:///x.sqlite"
    assert import_catalog.parse_args(["--db", url]).db == url


def test_print_report_lists_counts_and_skips(capsys: pytest.CaptureFixture[str]) -> None:
    report = importer.Report()
    report.counts["species"] = 3
    report.counts["species_name"] = 5
    report.skipped["measurement_ohne_koerperteil"] = 2
    import_catalog.print_report(report)
    out = capsys.readouterr().out
    assert "species: 3" in out
    assert "species_name: 5" in out
    assert "übersprungen measurement_ohne_koerperteil: 2" in out


def test_main_runs_end_to_end(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    db_path = tmp_path / "catalog.sqlite"
    import_catalog.main(["--db", f"sqlite+aiosqlite:///{db_path}"])
    out = capsys.readouterr().out
    assert f"species: {species_file_count()}" in out

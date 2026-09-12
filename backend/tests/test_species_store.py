"""Der Rundlauf: ein Profil in die Tabellen und unveraendert zurueck.

Dieser Test ist die Abnahme der Wanderung aus R4b. Er vergleicht nicht ein
Feld, sondern das ganze Profil, und das fuer jede ausgelieferte Art. Faellt
eine Spalte weg, faellt er auf, und zwar bei der Art, an der es liegt.
"""

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import db
from app.models import (
    Phase,
    SpeciesCapMargin,
    SpeciesRow,
    SpeciesStemFeature,
    SpeciesTerm,
    SpeciesTrait,
)
from app.modules.species.catalog import DATA, read_profiles
from app.modules.species.schemas import Profile, StemFeature
from app.modules.species.store import UnknownTerm, load_profiles, save_profiles

pytestmark = pytest.mark.usefixtures("migrated")


def shipped() -> dict[str, Profile]:
    """Die Profile, wie sie als TOML mit dem Backend gehen."""
    return read_profiles(DATA / "arten")


async def session() -> AsyncSession:
    """Eine Sitzung auf die Datei des Tests."""
    return db.session_factory()()


async def stored() -> tuple[dict[str, Profile], dict[str, Profile]]:
    """Schreibt den Anfangsbestand und liest ihn wieder. Beide Seiten zurueck."""
    profiles = shipped()
    async with await session() as open_ring:
        await save_profiles(open_ring, profiles)
        await open_ring.commit()
    async with await session() as open_ring:
        return profiles, await load_profiles(open_ring)


async def test_every_shipped_profile_survives_the_round_trip() -> None:
    written, read_back = await stored()

    assert set(read_back) == set(written)
    for slug, profile in written.items():
        assert read_back[slug] == profile, slug


async def test_the_tables_hold_one_row_per_species() -> None:
    written, _ = await stored()

    async with await session() as open_ring:
        count = await open_ring.scalar(select(func.count()).select_from(SpeciesRow))

    assert count == len(written)


async def test_a_species_without_a_hymenophore_leaves_the_columns_empty() -> None:
    _, read_back = await stored()

    # Der Gezonte Ohrlappenpilz traegt keine der fuenf Fruchtschichten.
    assert read_back["gezonter-ohrlappenpilz"].hymenophore is None


async def test_the_cap_margin_keeps_its_phases() -> None:
    _, read_back = await stored()

    # Der Erlengruebling ist jung eingerollt und alt scharfkantig.
    margin = read_back["erlengruebling"].cap_margin
    assert margin is not None
    assert (margin.start, margin.end) == (["eingerollt"], ["scharf"])


async def test_a_margin_without_a_change_carries_no_phase() -> None:
    await stored()

    async with await session() as open_ring:
        rows = (
            await open_ring.scalars(
                select(SpeciesCapMargin)
                .join(SpeciesRow)
                .where(SpeciesRow.slug == "steinpilz")
                .order_by(SpeciesCapMargin.position)
            )
        ).all()

    assert [(row.margin, row.phase) for row in rows] == [("eingerollt", None)]


async def test_both_states_of_a_stem_reach_the_table() -> None:
    await stored()

    async with await session() as open_ring:
        rows = (
            await open_ring.scalars(
                select(SpeciesStemFeature)
                .join(SpeciesRow)
                .where(SpeciesRow.slug == "grauer-leistling")
            )
        ).all()

    # Die Phase ist noch leer: die Liste im Profil kennt sie nicht. Die Spalte
    # steht bereit, das Fuellen ist Karte 93.
    assert {row.feature for row in rows} == {StemFeature.HOLLOW, StemFeature.SOLID}
    assert {row.phase for row in rows} == {None}
    assert Phase.YOUNG.value == "jung"


async def test_the_trait_table_holds_the_prose_of_the_source() -> None:
    await stored()

    async with await session() as open_ring:
        count = await open_ring.scalar(select(func.count()).select_from(SpeciesTrait))

    # Neun Zeilen je Art waeren 2754; nicht jede Art fuehrt jede Zeile.
    assert count is not None
    assert count > 2000


async def test_every_tag_points_at_the_term_catalogue() -> None:
    await stored()

    async with await session() as open_ring:
        rows = (await open_ring.scalars(select(SpeciesTerm))).all()

    assert rows
    assert all(row.term_id > 0 for row in rows)


async def test_an_unknown_tag_is_refused() -> None:
    profiles = shipped()
    broken = profiles["steinpilz"].model_copy(
        update={"smell": profiles["steinpilz"].smell.model_copy(update={"tags": ["nach Diesel"]})}
    )

    async with await session() as open_ring:
        with pytest.raises(UnknownTerm, match="nach Diesel"):
            await save_profiles(open_ring, {"steinpilz": broken})


async def test_an_empty_table_gives_an_empty_catalogue() -> None:
    # Die Wanderung setzt den Anfangsbestand. Ohne ihn — eine Datenbank, die
    # gerade erst ihr Schema bekommen hat — antwortet der Leser leer statt zu
    # scheitern.
    async with await session() as open_ring:
        await open_ring.execute(delete(SpeciesRow))
        await open_ring.commit()
        assert await load_profiles(open_ring) == {}

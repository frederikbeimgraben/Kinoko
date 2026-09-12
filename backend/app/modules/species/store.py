"""Das Profil einer Art in die Tabellen und wieder heraus.

Der Katalog rechnet weiter mit ``Profile``. Diese Schicht ist nur der Weg
dorthin: sie schreibt ein Profil in die vierzehn Tabellen und liest es
unveraendert zurueck. Genau das prueft ``test_species_store``, fuer alle
ausgelieferten Profile auf einmal.

Warum nicht die Tabellen direkt im Katalog? Weil dann jede Abfrage, jeder
Filter und jeder Test aus D1 bis D8 sich aendern muesste, ohne dass eine
Antwort anders aussaehe. Das Profil bleibt die Sprache des Katalogs.
"""

from collections import defaultdict
from collections.abc import Iterable, Sequence
from typing import Final

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    BodyPart,
    ChangePart,
    Dimension,
    NameKind,
    Phase,
    SourceScope,
    SpeciesCapFeature,
    SpeciesCapMargin,
    SpeciesColour,
    SpeciesColourChange,
    SpeciesLookalike,
    SpeciesMeasurement,
    SpeciesName,
    SpeciesReagent,
    SpeciesRow,
    SpeciesSeason,
    SpeciesSource,
    SpeciesStemFeature,
    SpeciesTerm,
    SpeciesTrait,
    SpeciesTree,
    Term,
    new_identifier,
)
from app.modules.species.schemas import (
    FROM_EXPERIENCE,
    CapMargin,
    ChangeSpeed,
    Colour,
    ColourChange,
    Colours,
    Development,
    Hymenophore,
    Link,
    Lookalike,
    Measurements,
    Period,
    Profile,
    Protection,
    Range,
    ReagentEntry,
    Source,
    TaggedText,
    TreeSource,
)

# Welches Feld der Masse welchem Paar aus Koerperteil und Strecke entspricht.
# Die sieben Felder sind sieben verschiedene Paare; darum braucht die Tabelle
# keine Reihenfolge.
MEASUREMENTS: Final[tuple[tuple[str, BodyPart, Dimension], ...]] = (
    ("cap_width_cm", BodyPart.CAP, Dimension.WIDTH),
    ("fruitbody_width_cm", BodyPart.FRUITBODY, Dimension.WIDTH),
    ("fruitbody_height_cm", BodyPart.FRUITBODY, Dimension.HEIGHT),
    ("stem_length_cm", BodyPart.STEM, Dimension.LENGTH),
    ("stem_thickness_cm", BodyPart.STEM, Dimension.THICKNESS),
    ("spore_length_um", BodyPart.SPORE, Dimension.LENGTH),
    ("spore_width_um", BodyPart.SPORE, Dimension.WIDTH),
)

# Welches Feld der Farben welchen Koerperteil meint.
COLOURS: Final[tuple[tuple[str, BodyPart], ...]] = (
    ("cap", BodyPart.CAP),
    ("hymenium", BodyPart.HYMENIUM),
    ("stem", BodyPart.STEM),
    ("flesh", BodyPart.FLESH),
    ("spore_print", BodyPart.SPORE_PRINT),
)

# Zu welchem Katalog in ``term`` ein Schlagwort gehoert.
SMELL_KIND: Final = "geruch"
TASTE_KIND: Final = "geschmack"


class UnknownTerm(LookupError):
    """Ein Schlagwort, das der Katalog ``term`` nicht kennt."""


def _tags(profile: Profile, index: dict[tuple[str, str], int]) -> list[int]:
    """Die Schlagworte von Geruch und Geschmack als Kennungen aus ``term``.

    Ein leerer Katalog heisst: es gibt noch keine Begriffe, und dann kann es
    auch keine Verweise darauf geben. Ein Katalog, der einen einzelnen Begriff
    nicht kennt, ist dagegen ein Fehler in den Daten.
    """
    if not index:
        return []
    wanted = [(SMELL_KIND, tag) for tag in profile.smell.tags]
    wanted += [(TASTE_KIND, tag) for tag in profile.taste.tags]
    missing = [f"{kind}/{slug}" for kind, slug in wanted if (kind, slug) not in index]
    if missing:
        raise UnknownTerm(f"Diese Schlagworte stehen nicht in term: {', '.join(missing)}.")
    return [index[key] for key in wanted]


def _row_of(profile: Profile, slug: str, identifier: str) -> SpeciesRow:
    """Die Zeile der Art selbst: alles, was genau einmal vorkommt."""
    layer = profile.hymenophore
    shape = profile.cap_shape
    period = profile.period
    change = profile.colours.change
    return SpeciesRow(
        id=identifier,
        slug=slug,
        name=profile.name,
        latin_name=profile.scientific,
        group=profile.group,
        edibility=profile.edibility,
        collectable=profile.collectable,
        marketable=profile.marketable,
        marketable_switzerland=profile.marketable_switzerland,
        value_rating=profile.rating,
        frequency=profile.frequency,
        red_list=profile.red_list,
        warning=profile.warning,
        map_name=profile.map_name,
        edibility_note=profile.edibility_note,
        protection_note=profile.protection_note,
        protection=profile.protection.status,
        protection_source=profile.protection.source,
        period_start_month=None if period is None else period.start_month,
        period_end_month=None if period is None else period.end_month,
        period_peak_month=None if period is None else period.peak_month,
        smell_text=profile.smell.text,
        taste_text=profile.taste.text,
        hymenium_type=None if layer is None else layer.kind,
        gill_attachment=None if layer is None else layer.attachment,
        gill_spacing=None if layer is None else layer.spacing,
        gill_edge=None if layer is None else layer.edge,
        cap_shape_young=None if shape is None else shape.start,
        cap_shape_old=None if shape is None else shape.end,
        colour_change_speed=None if change is None else change.speed,
    )


def _children(profile: Profile, identifier: str, tag_ids: Sequence[int]) -> list[object]:
    """Alle Kindzeilen eines Profils, ohne die Verwechslungen.

    Die stehen erst, wenn jede Art ihre Kennung hat: ein Paar zeigt auf eine
    zweite Zeile, die es beim ersten Durchgang noch nicht geben muss.
    """
    rows: list[object] = []
    names = [(name, NameKind.COMMON) for name in profile.other_names]
    names += [(name, NameKind.SYNONYM) for name in profile.synonyms]
    rows += [
        SpeciesName(species_id=identifier, position=index, name=name, kind=kind)
        for index, (name, kind) in enumerate(names)
    ]
    for field, part, dimension in MEASUREMENTS:
        span: Range | None = getattr(profile.measurements, field)
        if span is None:
            continue
        rows.append(
            SpeciesMeasurement(
                species_id=identifier,
                part=part,
                dimension=dimension,
                low=span.start,
                high=span.end,
                rare_low=span.rare_from,
                rare_high=span.rare_until,
                unit=span.unit,
                description=span.description,
            )
        )
    for field, part in COLOURS:
        colours: list[Colour] = getattr(profile.colours, field)
        rows += [
            SpeciesColour(
                species_id=identifier, part=part, position=index, name=one.name, hex=one.hex
            )
            for index, one in enumerate(colours)
        ]
    change = profile.colours.change
    if change is not None:
        for part, colours in ((ChangePart.FROM, change.start), (ChangePart.TO, change.end)):
            rows += [
                SpeciesColourChange(
                    species_id=identifier, part=part, position=index, name=one.name, hex=one.hex
                )
                for index, one in enumerate(colours)
            ]
    rows += [
        SpeciesCapFeature(species_id=identifier, position=index, feature=feature)
        for index, feature in enumerate(profile.cap_features)
    ]
    rows += _margin_rows(profile, identifier)
    rows += [
        SpeciesStemFeature(species_id=identifier, position=index, feature=feature)
        for index, feature in enumerate(profile.stem_features)
    ]
    rows += [
        SpeciesReagent(
            species_id=identifier, position=index, reagent=entry.reagent, reaction=entry.reaction
        )
        for index, entry in enumerate(profile.reagents)
    ]
    rows += [
        SpeciesTrait(species_id=identifier, key=key, text=text)
        for key, text in profile.traits.items()
    ]
    rows.append(
        SpeciesSource(
            species_id=identifier,
            position=0,
            scope=SourceScope.PROFILE,
            url=profile.source.url,
            checked_on=profile.source.checked_on,
        )
    )
    rows += [
        SpeciesSource(
            species_id=identifier,
            position=index + 1,
            scope=SourceScope.FURTHER,
            title=link.title,
            url=link.url,
        )
        for index, link in enumerate(profile.links)
    ]
    rows += [
        SpeciesSeason(species_id=identifier, position=index, season=season)
        for index, season in enumerate(profile.seasons)
    ]
    rows += _tree_rows(profile, identifier)
    rows += [
        SpeciesTerm(species_id=identifier, position=index, term_id=term_id)
        for index, term_id in enumerate(tag_ids)
    ]
    return rows


def _margin_rows(profile: Profile, identifier: str) -> list[SpeciesCapMargin]:
    """Der Hutrand, je Zustand eine Zeile.

    Nennt die Quelle keine Veraenderung, bleibt die Phase leer: der Rand gilt
    dann durchgehend. Nennt sie eine, tragen die Zeilen jung und alt.
    """
    margin = profile.cap_margin
    if margin is None:
        return []
    if margin.end is None:
        stages: list[tuple[Phase | None, list[CapMargin]]] = [(None, margin.start)]
    else:
        stages = [(Phase.YOUNG, margin.start), (Phase.OLD, margin.end)]
    rows: list[SpeciesCapMargin] = []
    for phase, values in stages:
        rows += [
            SpeciesCapMargin(
                species_id=identifier, position=len(rows) + index, margin=value, phase=phase
            )
            for index, value in enumerate(values)
        ]
    return rows


def _tree_rows(profile: Profile, identifier: str) -> list[SpeciesTree]:
    """Die Baumpartner, die belegten zuerst, die eigenen danach."""
    own = profile.trees_from_experience
    pairs = [(tree, False) for tree in profile.trees]
    pairs += [] if own is None else [(tree, True) for tree in own.trees]
    return [
        SpeciesTree(species_id=identifier, position=index, tree=tree, from_experience=experience)
        for index, (tree, experience) in enumerate(pairs)
    ]


def plan(
    profiles: dict[str, Profile], index: dict[tuple[str, str], int]
) -> tuple[dict[str, str], list[list[object]]]:
    """Baut alle Zeilen, in drei Stufen, und dazu Slug auf Kennung.

    Drei Stufen, weil die Reihenfolge zaehlt: erst die Arten, dann ihre Kinder,
    zuletzt die Verwechslungen. Ein Paar zeigt auf eine zweite Art, und die
    muss stehen, bevor der Fremdschluessel greift.

    Rein und ohne Sitzung, damit die Wanderung dieselben Zeilen baut wie der
    Dienst. Zwei Bauplaene liefen auseinander, sobald eine Spalte dazukommt.
    """
    identifiers = {slug: new_identifier() for slug in profiles}
    species: list[object] = [
        _row_of(profile, slug, identifiers[slug]) for slug, profile in profiles.items()
    ]
    children: list[object] = [
        row
        for slug, profile in profiles.items()
        for row in _children(profile, identifiers[slug], _tags(profile, index))
    ]
    pairs: list[object] = [
        SpeciesLookalike(
            species_id=identifiers[slug],
            position=position,
            other_id=identifiers[pair.slug],
            difference=pair.difference,
            own_difference=pair.own_difference,
        )
        for slug, profile in profiles.items()
        for position, pair in enumerate(profile.lookalikes)
    ]
    return identifiers, [species, children, pairs]


def species_rows(profiles: dict[str, Profile]) -> list[SpeciesRow]:
    """Nur die Zeilen der Arten selbst, ohne Kinder.

    Der Fremdschluessel von ``find`` und ``species_image`` haengt an
    ``species.slug``. Wer nur ihn braucht — eine Vorrichtung im Test, eine
    Pruefung — braucht die vierzehn Kindtabellen nicht.
    """
    return [_row_of(profile, slug, new_identifier()) for slug, profile in profiles.items()]


def term_index(rows: Iterable[Term]) -> dict[tuple[str, str], int]:
    """Der Katalog ``term`` als Nachschlagewerk aus Art und Slug."""
    return {(row.kind, row.slug): row.id for row in rows}


async def save_profiles(session: AsyncSession, profiles: dict[str, Profile]) -> dict[str, str]:
    """Schreibt alle Profile in die Tabellen und gibt Slug auf Kennung zurueck.

    Der Bestand geht vorher weg. Diese Funktion setzt den Anfangsbestand, sie
    pflegt ihn nicht: eine spaetere Aenderung ist ein Schreibvorgang auf einer
    Art, kein neuer Durchlauf ueber alle.
    """
    index = term_index((await session.scalars(select(Term))).all())
    await session.execute(delete(SpeciesRow))
    identifiers, stages = plan(profiles, index)
    for stage in stages:
        session.add_all(stage)
        await session.flush()
    return identifiers


def _grouped[R](rows: Iterable[R], key: str = "species_id") -> dict[str, list[R]]:
    """Sortiert Kindzeilen nach ihrer Art. Die Reihenfolge der Abfrage bleibt."""
    out: dict[str, list[R]] = defaultdict(list)
    for row in rows:
        out[getattr(row, key)].append(row)
    return out


def _measurements(rows: Sequence[SpeciesMeasurement]) -> Measurements:
    found = {(row.part, row.dimension): row for row in rows}
    spans: dict[str, Range] = {}
    for field, part, dimension in MEASUREMENTS:
        row = found.get((part, dimension))
        if row is None:
            continue
        spans[field] = Range(
            start=row.low,
            end=row.high,
            rare_from=row.rare_low,
            rare_until=row.rare_high,
            unit=row.unit,
            description=row.description,
        )
    return Measurements(**spans)


def _colours(
    rows: Sequence[SpeciesColour],
    changes: Sequence[SpeciesColourChange],
    speed: ChangeSpeed | None,
) -> Colours:
    by_part: dict[BodyPart, list[Colour]] = defaultdict(list)
    for row in rows:
        by_part[row.part].append(Colour(name=row.name, hex=row.hex))
    parts = {field: by_part.get(part, []) for field, part in COLOURS}
    change = None
    if changes:
        sides: dict[ChangePart, list[Colour]] = defaultdict(list)
        for row in changes:
            sides[row.part].append(Colour(name=row.name, hex=row.hex))
        change = ColourChange(
            start=sides.get(ChangePart.FROM, []),
            end=sides.get(ChangePart.TO, []),
            speed=speed,
        )
    return Colours(**parts, change=change)


def _cap_margin(rows: Sequence[SpeciesCapMargin]) -> Development[list[CapMargin]] | None:
    """Der Hutrand aus seinen Zeilen. Ohne Phase gilt ein Zustand durchgehend."""
    if not rows:
        return None
    if all(row.phase is None for row in rows):
        return Development[list[CapMargin]](start=[row.margin for row in rows])
    return Development[list[CapMargin]](
        start=[row.margin for row in rows if row.phase is Phase.YOUNG],
        end=[row.margin for row in rows if row.phase is Phase.OLD],
    )


def _trees(rows: Sequence[SpeciesTree]) -> tuple[list[str], TreeSource | None]:
    known = [row.tree for row in rows if not row.from_experience]
    own = [row.tree for row in rows if row.from_experience]
    source = None if not own else TreeSource(trees=own, source=FROM_EXPERIENCE)
    return known, source  # pyright: ignore[reportReturnType]


def _sources(rows: Sequence[SpeciesSource]) -> tuple[Source, list[Link]]:
    page = next(row for row in rows if row.scope is SourceScope.PROFILE)
    links = [
        Link(title=row.title or "", url=row.url) for row in rows if row.scope is SourceScope.FURTHER
    ]
    return Source(url=page.url, checked_on=page.checked_on or ""), links


async def load_profiles(session: AsyncSession) -> dict[str, Profile]:
    """Liest alle Profile aus den Tabellen zurueck.

    Ein Select je Tabelle, dann in Python gruppieren. 306 Arten sind zu wenig,
    als dass ein Verbund je Kind sich lohnte, und der Katalog liest einmal beim
    Start, nicht je Anfrage.
    """
    species = (await session.scalars(select(SpeciesRow).order_by(SpeciesRow.slug))).all()
    if not species:
        return {}
    slugs = {row.id: row.slug for row in species}
    terms = {row.id: row for row in (await session.scalars(select(Term))).all()}

    async def children[R](model: type[R], *order: object) -> dict[str, list[R]]:
        statement = select(model).order_by(*order)  # pyright: ignore[reportArgumentType]
        return _grouped((await session.scalars(statement)).all())

    names = await children(SpeciesName, SpeciesName.position)
    measures = await children(SpeciesMeasurement, SpeciesMeasurement.part)
    colours = await children(SpeciesColour, SpeciesColour.position)
    changes = await children(SpeciesColourChange, SpeciesColourChange.position)
    cap_features = await children(SpeciesCapFeature, SpeciesCapFeature.position)
    margins = await children(SpeciesCapMargin, SpeciesCapMargin.position)
    stem_features = await children(SpeciesStemFeature, SpeciesStemFeature.position)
    reagents = await children(SpeciesReagent, SpeciesReagent.position)
    traits = await children(SpeciesTrait, SpeciesTrait.key)
    sources = await children(SpeciesSource, SpeciesSource.position)
    seasons = await children(SpeciesSeason, SpeciesSeason.position)
    trees = await children(SpeciesTree, SpeciesTree.position)
    tags = await children(SpeciesTerm, SpeciesTerm.position)
    lookalikes = await children(SpeciesLookalike, SpeciesLookalike.position)

    out: dict[str, Profile] = {}
    for row in species:
        known_trees, own_trees = _trees(trees[row.id])
        page, links = _sources(sources[row.id])
        chosen = [terms[entry.term_id] for entry in tags[row.id]]
        layer = None
        if row.hymenium_type is not None:
            layer = Hymenophore(
                kind=row.hymenium_type,
                attachment=row.gill_attachment,
                spacing=row.gill_spacing,
                edge=row.gill_edge,
            )
        period = None
        if row.period_start_month is not None and row.period_end_month is not None:
            period = Period(
                start_month=row.period_start_month,
                end_month=row.period_end_month,
                peak_month=row.period_peak_month,
            )
        # Als Abbildung, nicht als Objekt: ein ``Development[CapShape]`` von
        # Hand gebaut kaeme aus einer anderen Auspraegung des Generikums und
        # wuerde beim Pruefen des Profils abgelehnt.
        shape = (
            None
            if row.cap_shape_young is None
            else {"von": row.cap_shape_young, "nach": row.cap_shape_old}
        )
        out[row.slug] = Profile(
            name=row.name,
            scientific=row.latin_name,
            group=row.group,
            edibility=row.edibility,
            seasons=[entry.season for entry in seasons[row.id]],
            trees=known_trees,  # pyright: ignore[reportArgumentType]
            trees_from_experience=own_trees,
            warning=row.warning,
            collectable=row.collectable,
            marketable=row.marketable,
            marketable_switzerland=row.marketable_switzerland,
            rating=row.value_rating,
            frequency=row.frequency,
            red_list=row.red_list,
            other_names=[e.name for e in names[row.id] if e.kind is NameKind.COMMON],
            synonyms=[e.name for e in names[row.id] if e.kind is NameKind.SYNONYM],
            measurements=_measurements(measures[row.id]),
            colours=_colours(colours[row.id], changes[row.id], row.colour_change_speed),
            period=period,
            protection=Protection(status=row.protection, source=row.protection_source),
            hymenophore=layer,
            cap_shape=shape,  # pyright: ignore[reportArgumentType]
            cap_features=[entry.feature for entry in cap_features[row.id]],
            cap_margin=_cap_margin(margins[row.id]),
            stem_features=[entry.feature for entry in stem_features[row.id]],
            smell=TaggedText(
                tags=[term.slug for term in chosen if term.kind == SMELL_KIND], text=row.smell_text
            ),
            taste=TaggedText(
                tags=[term.slug for term in chosen if term.kind == TASTE_KIND], text=row.taste_text
            ),
            map_name=row.map_name,
            edibility_note=row.edibility_note,
            protection_note=row.protection_note,
            source=page,
            reagents=[
                ReagentEntry(reagent=e.reagent, reaction=e.reaction) for e in reagents[row.id]
            ],
            traits={entry.key: entry.text for entry in traits[row.id]},
            lookalikes=[
                Lookalike(
                    slug=slugs[entry.other_id],
                    difference=entry.difference,
                    own_difference=entry.own_difference,
                )
                for entry in lookalikes[row.id]
            ],
            links=links,
        )
    return out

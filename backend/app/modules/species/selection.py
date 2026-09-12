"""Die Auswahl der Liste: mehrere Werte je Gruppe, und was die Luecke kostet.

Innerhalb einer Gruppe gilt oder, zwischen den Gruppen gilt und. Das ist die
Verknuepfung, die jeder Filter hat und die niemand erklaeren muss.

Drei Antworten kann eine Art auf eine Gruppe geben.

  ``MATCH``  sie traegt einen der gewaehlten Werte.
  ``MISS``   sie traegt einen anderen. Sie passt nicht.
  ``UNKNOWN`` die Quelle sagt nichts. Sie passt vielleicht.

Der dritte Fall ist der Grund fuer dieses Modul. Wer nach der Hutform filtert,
schliesst 212 der 306 Arten aus, weil die Angabe fehlt, und nicht weil sie
nicht passen. Sie fallen darum nicht still heraus: sie kommen als eigene Menge
zurueck, und je Gruppe steht, wie viele allein an ihr scheitern. Erst damit
weiss jemand, welchen Filter er fallen lassen muesste.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import Enum

from app.modules.species.schemas import FacetKey, Profile
from app.modules.species.traits import FACET_BY_KEY, said_about


class Answer(Enum):
    """Was eine Art zu einer Gruppe sagt."""

    MATCH = "match"
    MISS = "miss"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class Selection:
    """Die gewaehlten Werte je Gruppe und die Gruppen, deren Luecke bleiben darf.

    ``keep_unknown`` nennt die Gruppen, in denen der Schalter "Arten ohne
    Angabe behalten" steht. Dort zaehlt ``UNKNOWN`` wie ein Treffer.
    """

    values: Mapping[FacetKey, frozenset[str]] = field(
        default_factory=dict[FacetKey, frozenset[str]]
    )
    keep_unknown: frozenset[FacetKey] = frozenset()

    @property
    def active(self) -> tuple[FacetKey, ...]:
        """Die Gruppen, in denen etwas gewaehlt ist. Leere schraenken nicht ein."""
        return tuple(key for key, chosen in self.values.items() if chosen)

    def answer(self, key: FacetKey, profile: Profile, said: set[str] | None = None) -> Answer:
        """Was eine Art zu einer Gruppe sagt.

        ``said`` traegt die Werte einer Gruppe, die nicht im Profil steht. Die
        Stufe faellt aus Datenlage und Karte, nicht aus der Quellseite.
        """
        carried = said_about(FACET_BY_KEY[key], profile) if said is None else said
        if not carried:
            return Answer.UNKNOWN
        return Answer.MATCH if carried & self.values[key] else Answer.MISS


@dataclass(frozen=True)
class Verdict:
    """Wie eine Art durch die Auswahl kommt."""

    hit: bool
    # Die Gruppen, in denen die Quelle nichts sagt und der Schalter aus ist.
    gaps: frozenset[FacetKey]
    # Wahr, sobald eine Gruppe die Art ausschliesst. Dann hilft kein Schalter.
    rejected: bool


def judge(
    selection: Selection,
    profile: Profile,
    outside: Mapping[FacetKey, set[str]] | None = None,
) -> Verdict:
    """Prueft eine Art gegen jede gesetzte Gruppe.

    ``outside`` traegt die Gruppen, die nicht im Profil stehen.
    """
    gaps: set[FacetKey] = set()
    rejected = False
    for key in selection.active:
        answer = selection.answer(key, profile, (outside or {}).get(key))
        if answer is Answer.MISS:
            rejected = True
        elif answer is Answer.UNKNOWN and key not in selection.keep_unknown:
            gaps.add(key)
    return Verdict(hit=not rejected and not gaps, gaps=frozenset(gaps), rejected=rejected)


def gaps_per_group(
    selection: Selection,
    profiles: Sequence[tuple[str, Profile]],
    outside: Mapping[str, Mapping[FacetKey, set[str]]] | None = None,
) -> dict[FacetKey, int]:
    """Wie viele Arten allein an einer Gruppe scheitern.

    Gezaehlt wird je Gruppe und nicht ueber alle zusammen: nur so sagt die Zahl,
    welchen Filter jemand fallen lassen muesste, um diese Arten zu sehen.
    """
    counted = dict.fromkeys(selection.active, 0)
    for slug, profile in profiles:
        verdict = judge(selection, profile, (outside or {}).get(slug))
        if verdict.rejected or len(verdict.gaps) != 1:
            continue
        counted[next(iter(verdict.gaps))] += 1
    return counted


def selection_of(chosen: Sequence[str], keep_unknown: Sequence[FacetKey]) -> Selection:
    """Baut die Auswahl aus den Parametern der Abfrage.

    Ein Wert steht als ``gruppe:wert``. Ein Paar, dessen Gruppe es nicht gibt,
    faellt weg: eine Adresse aus einem alten Lesezeichen soll die Liste nicht
    mit einem Fehler beantworten, sondern mit dem, was sie versteht.
    """
    values: dict[FacetKey, set[str]] = {}
    for pair in chosen:
        group, _, value = pair.partition(":")
        if not value or group not in {key.value for key in FacetKey}:
            continue
        values.setdefault(FacetKey(group), set()).add(value)
    return Selection(
        values={key: frozenset(chosen_values) for key, chosen_values in values.items()},
        keep_unknown=frozenset(keep_unknown),
    )

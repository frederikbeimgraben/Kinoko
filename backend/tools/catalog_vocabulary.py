"""Abbildung der deutschen Profilwerte auf die englischen Aufzählungen."""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping

_UMLAUTS = str.maketrans(
    {"ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss"}
)
_NON_SLUG = re.compile(r"[^a-z0-9]+")


class UnknownVocabulary(ValueError):
    """Ein deutscher Wert ohne Eintrag in der Abbildungstabelle."""


def slugify(text: str) -> str:
    """Wandelt einen deutschen Text in einen Slug aus Kleinbuchstaben."""
    ascii_text = text.translate(_UMLAUTS).encode("ascii", "ignore").decode("ascii")
    return _NON_SLUG.sub("-", ascii_text.lower()).strip("-")


def lookup(table: Mapping[str, str], value: str, *, field: str, source: str) -> str:
    """Schlägt einen deutschen Wert nach, oder meldet ihn als unbekannt."""
    try:
        return table[value]
    except KeyError as error:
        raise UnknownVocabulary(f"Unbekannter Wert '{value}' für {field} in {source}.") from error


GROUP: dict[str, str] = {
    "roehrling": "bolete",
    "raufussroehrling": "rough_stemmed_bolete",
    "schmierroehrling": "slippery_jack",
    "leistling": "chanterelle",
    "stoppelpilz": "hedgehog",
    "milchling": "milkcap",
    "taeubling": "brittlegill",
    "schirmling": "parasol",
    "champignon": "agaricus",
    "tintling": "inkcap",
    "staeubling": "puffball",
    "trichterling": "funnel",
    "roetelritterling": "blewit",
    "hallimasch": "honey_fungus",
    "schueppling": "scalycap",
    "ruebling": "toughshank",
    "schleimruebling": "porcelain",
    "seitling": "oyster",
    "stachelbart": "lions_mane",
    "porling": "polypore",
    "glucke": "cauliflower",
    "ritterling": "knight",
    "schwindling": "parachute",
    "schneckling": "woodwax",
    "wulstling": "amanita",
    "morchel": "morel",
    "ohrlappenpilz": "jelly_ear",
    "gelbfuss": "spike",
    "schleierling": "webcap",
    "rasling": "domecap",
    "roetling": "pinkgill",
    "stachelpilz": "spine_fungus",
    "becherling": "cup_fungus",
}

EDIBILITY: dict[str, str] = {
    "essbar": "edible",
    "bedingtEssbar": "conditionally_edible",
    "ungeniessbar": "inedible",
    "giftig": "poisonous",
    "toedlichGiftig": "deadly",
}

PROTECTION: dict[str, str] = {
    "keiner": "none",
    "besondersGeschuetzt": "personal_use",
    "strengGeschuetzt": "strict",
}

FREQUENCY: dict[str, str] = {
    "sehrHaeufig": "very_common",
    "haeufig": "common",
    "zerstreut": "scattered",
    "selten": "rare",
    "sehrSelten": "very_rare",
}

RED_LIST: dict[str, str] = {
    "vomAussterbenBedroht": "critically_endangered",
    "starkGefaehrdet": "endangered",
    "gefaehrdet": "vulnerable",
    "unbekanntesAusmass": "unknown_extent",
    "extremSelten": "extremely_rare",
    "vorwarnliste": "near_threatened",
    "datenUnzureichend": "data_deficient",
}

SEASON: dict[str, str] = {
    "fruehling": "spring",
    "sommer": "summer",
    "herbst": "autumn",
    "winter": "winter",
}

TAXON_RANK: dict[str, str] = {
    "abteilung": "division",
    "klasse": "class",
    "ordnung": "order",
    "familie": "family",
    "gattung": "genus",
}

UNIT: dict[str, str] = {"cm": "cm", "mm": "mm", "um": "um"}

SPEED: dict[str, str] = {"schnell": "immediate", "langsam": "longer"}

HYMENIUM_TYPE: dict[str, str] = {
    "lamellen": "gills",
    "roehren": "tubes",
    "poren": "pores",
    "stacheln": "spines",
    "leisten": "folds",
}

GILL_ATTACHMENT: dict[str, str] = {
    "frei": "free",
    "angewachsen": "adnate",
    "ausgebuchtet": "emarginate",
    "herablaufend": "decurrent",
}

GILL_SPACING: dict[str, str] = {"eng": "close", "normal": "normal", "weit": "distant"}

GILL_EDGE: dict[str, str] = {"glatt": "smooth", "gesaegt": "serrate", "bewimpert": "ciliate"}

CAP_SHAPE: dict[str, str] = {
    "halbkugelig": "hemispherical",
    "gewoelbt": "convex",
    "flach": "flat",
    "niedergedrueckt": "depressed",
    "trichterfoermig": "funnel",
    "kegelig": "conical",
    "glockig": "bell",
    "eifoermig": "egg",
    "kugelig": "spherical",
    "muschelfoermig": "shell",
    "birnenfoermig": "pear",
    "keulig": "club",
    "zylindrisch": "cylindrical",
}

CAP_FEATURE: dict[str, str] = {
    "gebuckelt": "umbonate",
    "hygrophan": "hygrophanous",
    "gezont": "zoned",
    "vertieft": "sunken",
    "unregelmaessig": "irregular",
    "genabelt": "navelled",
}

CAP_MARGIN: dict[str, str] = {
    "eingerollt": "inrolled",
    "wellig": "wavy",
    "gerieft": "striate",
    "gerissen": "cracked",
    "fransig": "fringed",
    "eingebogen": "incurved",
    "ueberstehend": "overhanging",
    "scharf": "sharp",
    "hoeckerig": "lobed",
}

STEM_FEATURE: dict[str, str] = {
    "ring": "ring",
    "knolle": "bulb",
    "hohl": "hollow",
    "faserig": "fibrous",
    "beflockt": "flocked",
    "voll": "solid",
    "genattert": "banded",
    "genetzt": "netted",
    "behaart": "hairy",
    "wurzelnd": "rooting",
    "gerieft": "striate",
    "scheide": "volva",
    "bruechig": "brittle",
}

TRAIT_KEY: dict[str, str] = {
    "fruchtkoerper": "fruitbody",
    "hut": "cap",
    "roehren": "tubes",
    "lamellen": "gills",
    "leisten": "folds",
    "stacheln": "spines",
    "poren": "pores",
    "milch": "milk",
    "stiel": "stem",
    "fleisch": "flesh",
    "geruch": "smell",
    "geschmack": "taste",
    "sporenpulver": "spore_print",
    "reagenzien": "reagents",
    "vorkommen": "habitat",
    "zeit": "season",
    "speisewert": "edibility",
    "schutz": "protection",
}

SMELL_NAME: dict[str, str] = {
    "angenehm": "Angenehm",
    "anisartig": "Anisartig",
    "bittermandel": "Bittermandel",
    "erdartig": "Erdartig",
    "fischartig": "Fischartig",
    "fruchtig": "Fruchtig",
    "gurkenartig": "Gurkenartig",
    "honigartig": "Honigartig",
    "karbolartig": "Karbolartig",
    "maggiartig": "Maggiartig",
    "mehlig": "Mehlig",
    "muffig": "Muffig",
    "obstartig": "Obstartig",
    "pilzig": "Pilzig",
    "rettichartig": "Rettichartig",
    "saeuerlich": "Säuerlich",
    "seifig": "Seifig",
    "spermatisch": "Spermatisch",
    "suesslich": "Süßlich",
    "unangenehm": "Unangenehm",
    "unauffaellig": "Unauffällig",
    "wuerzig": "Würzig",
}

TASTE_NAME: dict[str, str] = {
    "bitter": "Bitter",
    "brennend": "Brennend",
    "herb": "Herb",
    "kratzend": "Kratzend",
    "mehlig": "Mehlig",
    "mild": "Mild",
    "nussig": "Nussig",
    "pilzig": "Pilzig",
    "saeuerlich": "Säuerlich",
    "scharf": "Scharf",
    "suesslich": "Süßlich",
    "unangenehm": "Unangenehm",
}

REAGENT_SLUG: dict[str, str] = {
    "koh": "koh",
    "naoh": "naoh",
    "feso4": "feso4",
    "guajak": "guaiac",
    "melzer": "melzer",
    "anilin": "aniline",
    "phenol": "phenol",
    "ammoniak": "ammonia",
    "sulfovanillin": "sulfovanillin",
    "formalin": "formalin",
    "fecl3": "fecl3",
    "wieland": "wieland",
    "schaeffer": "schaeffer",
}

REAGENT_NAME: dict[str, str] = {
    "koh": "Kalilauge (KOH)",
    "naoh": "Natronlauge (NaOH)",
    "feso4": "Eisensulfat (FeSO4)",
    "guaiac": "Guajak",
    "melzer": "Melzers Reagenz",
    "aniline": "Anilin",
    "phenol": "Phenol",
    "ammonia": "Ammoniak",
    "sulfovanillin": "Sulfovanillin",
    "formalin": "Formalin",
    "fecl3": "Eisenchlorid (FeCl3)",
    "wieland": "Wieland-Reagenz",
    "schaeffer": "Schäffer-Reaktion",
}

TREE: dict[str, tuple[str, str]] = {
    "fichte": ("spruce", "Fichte"),
    "kiefer": ("pine", "Kiefer"),
    "tanne": ("fir", "Tanne"),
    "laerche": ("larch", "Lärche"),
    "douglasie": ("douglas-fir", "Douglasie"),
    "buche": ("beech", "Buche"),
    "eiche": ("oak", "Eiche"),
    "birke": ("birch", "Birke"),
    "erle": ("alder", "Erle"),
    "robinie": ("black-locust", "Robinie"),
    "eibe": ("yew", "Eibe"),
    "goldregen": ("laburnum", "Goldregen"),
    "heidelbeere": ("bilberry", "Heidelbeere"),
    "steineiche": ("holm-oak", "Steineiche"),
    "hainbuche": ("hornbeam", "Hainbuche"),
    "hasel": ("hazel", "Hasel"),
    "pappel": ("poplar", "Pappel"),
    "weide": ("willow", "Weide"),
    "linde": ("lime", "Linde"),
    "esche": ("ash", "Esche"),
    "ulme": ("elm", "Ulme"),
    "ahorn": ("maple", "Ahorn"),
    "kastanie": ("chestnut", "Kastanie"),
    "holunder": ("elder", "Holunder"),
    "obstbaum": ("fruit-tree", "Obstbaum"),
}

TRIGGER_MECHANICAL: tuple[tuple[str, str], ...] = (
    ("pressure", "Druck"),
    ("cut", "Schnitt"),
    ("bruise", "Druckstelle"),
)

TRIGGER_ENVIRONMENT: tuple[tuple[str, str], ...] = (
    ("heat", "Hitze"),
    ("drought", "Trockenheit"),
    ("frost", "Frost"),
    ("age", "Alter"),
    ("moisture", "Feuchtigkeit"),
)

CUT_TRIGGER_SLUG = "cut"


def build_colour_vocabulary(entries: Iterable[tuple[str, str]]) -> dict[str, str]:
    """Baut das Farbwörterbuch aus allen Name-Hex-Paaren der Profile."""
    return dict(entries)


def find_colour(text: str, vocabulary: Mapping[str, str]) -> tuple[str, str] | None:
    """Findet die zuletzt genannte bekannte Farbe in einem Reaktionstext."""
    lowered = text.lower()
    spans: list[tuple[int, int, str]] = []
    for name in vocabulary:
        start = 0
        while (index := lowered.find(name, start)) != -1:
            spans.append((index, index + len(name), name))
            start = index + 1
    spans.sort(key=lambda span: (span[0], span[0] - span[1]))
    kept: list[tuple[int, int, str]] = []
    for start, end, name in spans:
        if any(start < k_end and end > k_start for k_start, k_end, _ in kept):
            continue
        kept.append((start, end, name))
    if not kept:
        return None
    kept.sort(key=lambda span: span[0])
    _, _, name = kept[-1]
    return name, vocabulary[name]

"""Aufzählungen des Artenkatalogs."""

from enum import StrEnum


class Edibility(StrEnum):
    """Speisewert einer Art."""

    EDIBLE = "edible"
    CONDITIONALLY_EDIBLE = "conditionally_edible"
    INEDIBLE = "inedible"
    POISONOUS = "poisonous"
    DEADLY = "deadly"


class Protection(StrEnum):
    """Schutzstatus einer Art."""

    NONE = "none"
    PERSONAL_USE = "personal_use"
    STRICT = "strict"


class Frequency(StrEnum):
    """Häufigkeit einer Art."""

    VERY_COMMON = "very_common"
    COMMON = "common"
    SCATTERED = "scattered"
    RARE = "rare"
    VERY_RARE = "very_rare"


class RedListStatus(StrEnum):
    """Stufe der Roten Liste."""

    CRITICALLY_ENDANGERED = "critically_endangered"
    ENDANGERED = "endangered"
    VULNERABLE = "vulnerable"
    UNKNOWN_EXTENT = "unknown_extent"
    EXTREMELY_RARE = "extremely_rare"
    NEAR_THREATENED = "near_threatened"
    DATA_DEFICIENT = "data_deficient"


class TaxonRank(StrEnum):
    """Rang eines Taxons."""

    DIVISION = "division"
    CLASS = "class"
    ORDER = "order"
    FAMILY = "family"
    GENUS = "genus"


class Season(StrEnum):
    """Jahreszeit."""

    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"
    WINTER = "winter"


class NameKind(StrEnum):
    """Art eines weiteren Namens."""

    COMMON = "common"
    SYNONYM = "synonym"


class SourceScope(StrEnum):
    """Umfang einer Quelle."""

    PROFILE = "profile"
    FURTHER = "further"


class TermKind(StrEnum):
    """Art eines Begriffs."""

    SMELL = "smell"
    TASTE = "taste"
    TREE = "tree"
    TRIGGER = "trigger"


class TriggerGroup(StrEnum):
    """Gruppe eines Auslösers."""

    MECHANICAL = "mechanical"
    REAGENT = "reagent"
    ENVIRONMENT = "environment"


class ColourMode(StrEnum):
    """Lesart der Farben eines Körperteils."""

    SINGLE = "single"
    GRADIENT = "gradient"
    DISTINCT = "distinct"


class Speed(StrEnum):
    """Dauer einer Verfärbung."""

    IMMEDIATE = "immediate"
    THIRTY_SECONDS = "30s"
    ONE_MINUTE = "1min"
    THREE_MINUTES = "3min"
    LONGER = "longer"
    PERMANENT = "permanent"


class Group(StrEnum):
    """Gruppe verwandter Arten."""

    BOLETE = "bolete"
    ROUGH_STEMMED_BOLETE = "rough_stemmed_bolete"
    SLIPPERY_JACK = "slippery_jack"
    CHANTERELLE = "chanterelle"
    HEDGEHOG = "hedgehog"
    MILKCAP = "milkcap"
    BRITTLEGILL = "brittlegill"
    PARASOL = "parasol"
    AGARICUS = "agaricus"
    INKCAP = "inkcap"
    PUFFBALL = "puffball"
    FUNNEL = "funnel"
    BLEWIT = "blewit"
    HONEY_FUNGUS = "honey_fungus"
    SCALYCAP = "scalycap"
    TOUGHSHANK = "toughshank"
    PORCELAIN = "porcelain"
    OYSTER = "oyster"
    LIONS_MANE = "lions_mane"
    POLYPORE = "polypore"
    CAULIFLOWER = "cauliflower"
    KNIGHT = "knight"
    PARACHUTE = "parachute"
    WOODWAX = "woodwax"
    AMANITA = "amanita"
    MOREL = "morel"
    JELLY_EAR = "jelly_ear"
    SPIKE = "spike"
    WEBCAP = "webcap"
    DOMECAP = "domecap"
    PINKGILL = "pinkgill"
    SPINE_FUNGUS = "spine_fungus"
    CUP_FUNGUS = "cup_fungus"


class TraitKey(StrEnum):
    """Abschnitt der Merkmalsprosa."""

    FRUITBODY = "fruitbody"
    CAP = "cap"
    TUBES = "tubes"
    GILLS = "gills"
    FOLDS = "folds"
    SPINES = "spines"
    PORES = "pores"
    MILK = "milk"
    STEM = "stem"
    FLESH = "flesh"
    SMELL = "smell"
    TASTE = "taste"
    SPORE_PRINT = "spore_print"
    REAGENTS = "reagents"
    HABITAT = "habitat"
    SEASON = "season"
    EDIBILITY = "edibility"
    PROTECTION = "protection"

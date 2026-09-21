"""Aufzählungen zu Körperteilen und ihren Merkmalen."""

from enum import StrEnum


class BodyPart(StrEnum):
    """Körperteil eines Fruchtkörpers."""

    FRUITBODY = "fruitbody"
    CAP = "cap"
    STEM = "stem"
    RING = "ring"
    STEM_BASE = "stem_base"
    GILLS = "gills"
    FLESH = "flesh"
    SPORE_PRINT = "spore_print"
    SPORE = "spore"
    TUBES = "tubes"
    PORES = "pores"


class Dimension(StrEnum):
    """Strecke eines Maßes."""

    WIDTH = "width"
    HEIGHT = "height"
    THICKNESS = "thickness"
    LENGTH = "length"


class Unit(StrEnum):
    """Einheit eines Maßes."""

    CM = "cm"
    MM = "mm"
    UM = "um"


class Phase(StrEnum):
    """Alter eines Fruchtkörpers."""

    YOUNG = "young"
    OLD = "old"


class HymeniumType(StrEnum):
    """Bauart der Fruchtschicht."""

    GILLS = "gills"
    TUBES = "tubes"
    PORES = "pores"
    SPINES = "spines"
    FOLDS = "folds"


class GillAttachment(StrEnum):
    """Ansatz der Lamellen am Stiel."""

    FREE = "free"
    ADNATE = "adnate"
    EMARGINATE = "emarginate"
    DECURRENT = "decurrent"


class GillSpacing(StrEnum):
    """Abstand der Lamellen."""

    CLOSE = "close"
    NORMAL = "normal"
    DISTANT = "distant"


class GillEdge(StrEnum):
    """Schneide der Lamellen."""

    SMOOTH = "smooth"
    SERRATE = "serrate"
    CILIATE = "ciliate"


class CapShape(StrEnum):
    """Form des Hutes."""

    HEMISPHERICAL = "hemispherical"
    CONVEX = "convex"
    FLAT = "flat"
    DEPRESSED = "depressed"
    FUNNEL = "funnel"
    CONICAL = "conical"
    BELL = "bell"
    EGG = "egg"
    SPHERICAL = "spherical"
    SHELL = "shell"
    PEAR = "pear"
    CLUB = "club"
    CYLINDRICAL = "cylindrical"


class CapFeature(StrEnum):
    """Merkmal der Hutfläche."""

    UMBONATE = "umbonate"
    HYGROPHANOUS = "hygrophanous"
    ZONED = "zoned"
    SUNKEN = "sunken"
    IRREGULAR = "irregular"
    NAVELLED = "navelled"


class CapMargin(StrEnum):
    """Merkmal des Hutrandes."""

    INROLLED = "inrolled"
    WAVY = "wavy"
    STRIATE = "striate"
    CRACKED = "cracked"
    FRINGED = "fringed"
    INCURVED = "incurved"
    OVERHANGING = "overhanging"
    SHARP = "sharp"
    LOBED = "lobed"


class StemFeature(StrEnum):
    """Merkmal des Stiels."""

    RING = "ring"
    BULB = "bulb"
    HOLLOW = "hollow"
    FIBROUS = "fibrous"
    FLOCKED = "flocked"
    SOLID = "solid"
    BANDED = "banded"
    NETTED = "netted"
    HAIRY = "hairy"
    ROOTING = "rooting"
    STRIATE = "striate"
    VOLVA = "volva"
    BRITTLE = "brittle"


PartFeature = CapFeature | CapMargin | StemFeature

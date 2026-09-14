"""Grundtypen und Aufzählungen ohne Fachbezug."""

from enum import StrEnum


class Area(StrEnum):
    """Bereich eines Rechts."""

    SPECIES = "species"
    INTERFACE = "interface"
    ACCESS = "access"
    DATA = "data"


class Visibility(StrEnum):
    """Sichtbarkeit eines eigenen Objekts."""

    PRIVATE = "private"
    SHARED = "shared"


class ReviewState(StrEnum):
    """Prüfstand eines Fundes."""

    OPEN = "open"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class ReviewDecision(StrEnum):
    """Entscheidung einer Prüfung."""

    ACCEPTED = "accepted"
    REJECTED = "rejected"


class PhotoState(StrEnum):
    """Stand eines Fotos."""

    PRIVATE = "private"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class PhotoSize(StrEnum):
    """Abgabegröße eines Fotos."""

    THUMB = "thumb"
    LIST = "list"
    FULL = "full"


class Licence(StrEnum):
    """Lizenz eines Fotos."""

    OWN = "own"
    CC0 = "cc0"
    CC_BY_4 = "cc_by_4"
    CC_BY_SA_4 = "cc_by_sa_4"
    PUBLIC_DOMAIN = "public_domain"


class MarkerColour(StrEnum):
    """Farbe eines Markers oder einer Zone."""

    GREEN = "green"
    BROWN = "brown"
    BLUE = "blue"
    RED = "red"
    GOLD = "gold"
    GREY = "grey"


class Rule(StrEnum):
    """Verknüpfung der Faktoren einer Kombination."""

    INTERSECTION = "intersection"
    GRADED = "graded"


class Condition(StrEnum):
    """Bedingung eines Faktors."""

    BELOW = "below"
    ABOVE = "above"
    BETWEEN = "between"


class RunKind(StrEnum):
    """Art eines Laufs der Kette."""

    TRAINING = "training"
    RENDER = "render"
    FULL = "full"


class RunState(StrEnum):
    """Zustand eines Laufs oder eines Schritts."""

    QUEUED = "queued"
    RUNNING = "running"
    FINISHED = "finished"
    FAILED = "failed"

"""Basis-Modell und gemeinsame Typen fuer den Vertrag zum Frontend."""

from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from app.shared import geometry


def to_camel(name: str) -> str:
    """Wandelt einen Feldnamen in camelCase, wie ihn das JSON traegt."""
    header, *rest = name.split("_")
    return header + "".join(part.capitalize() for part in rest)


def _with_timezone(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("Der Zeitpunkt braucht eine Zeitzone.")
    return value


# Ein Zeitpunkt ohne Zeitzone vergleicht sich falsch, sobald er auf einen
# bewussten trifft. Der Vertrag laesst darum nur ISO-8601 mit Offset zu.
Timestamp = Annotated[datetime, AfterValidator(_with_timezone)]


class BaseSchema(BaseModel):
    """Gemeinsame Wurzel aller Modelle: camelCase im JSON, keine fremden Felder."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class Week(BaseSchema):
    """Eine ISO-Kalenderwoche, so wie sie auf dem Draht steht."""

    year: int = Field(validation_alias="jahr", serialization_alias="jahr")
    week: int = Field(validation_alias="woche", serialization_alias="woche")

    @model_validator(mode="after")
    def _must_exist(self) -> "Week":
        # Nur manche Jahre haben eine 53. Woche. fromisocalendar kennt die Regel.
        try:
            date.fromisocalendar(self.year, self.week, 1)
        except ValueError as error:
            raise ValueError(f"Die Woche {self.week} gibt es {self.year} nicht.") from error
        return self


class Visibility(StrEnum):
    """Wer ein Objekt sehen darf."""

    PRIVATE = "privat"
    SHARED = "geteilt"


class Rule(StrEnum):
    """Wie die Kombination ihre Faktoren verrechnet.

    ``schnitt`` faerbt, wo jede Bedingung zutrifft. ``abgestuft`` zeigt das
    geometrische Mittel der Erfuellungsgrade, so bleibt sichtbar, wo es knapp
    ist. Die Spalte in ``models.py`` baut auf diesem Enum auf.
    """

    INTERSECTION = "schnitt"
    GRADED = "abgestuft"


class Licence(StrEnum):
    """Unter welchem Recht ein Artbild steht.

    ``own`` heisst: die Person hat das Bild selbst aufgenommen und gibt es der
    App. Jeder andere Wert nennt die Lizenz, unter der das Bild schon steht.
    Eine freie Eingabe gibt es nicht, sonst stuende dort irgendwann "frei".
    """

    OWN = "own"
    CC0 = "cc0"
    CC_BY_4 = "cc-by-4"
    CC_BY_SA_4 = "cc-by-sa-4"
    PUBLIC_DOMAIN = "public-domain"


class ImageState(StrEnum):
    """Wo ein Artbild in der Pruefung steht."""

    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class TaxonRank(StrEnum):
    """Die Stufe eines Taxons in der Einordnung, von weit nach eng.

    Ein Rang mehr ist ein Glied hier und Zeilen in ``taxon``: die Tabelle
    verkettet sich ueber sich selbst und kennt den Abstand zur Wurzel nicht.
    Wie tief eine Stufe steht, sagt nicht die Stelle in dieser Liste, sondern
    ``taxon.rank_order``. Wer einen Rang dazwischen setzt, schreibt sonst jede
    vorhandene Zeile um.
    """

    DIVISION = "abteilung"
    CLASS = "klasse"
    ORDER = "ordnung"
    FAMILY = "familie"
    GENUS = "gattung"


class TaxonStep(BaseSchema):
    """Ein Taxon, so knapp wie eine Verweiszeile es braucht.

    Der Schritt steht hier und nicht im Modul ``taxonomy``: die Artseite traegt
    ihre Einordnung, und die Taxonomieseite traegt Arten. Beide Vertraege
    zeigten sonst im Kreis aufeinander.
    """

    rank: TaxonRank = Field(validation_alias="rang", serialization_alias="rang")
    # Wie tief der Rang steht, oben null. Die Oberflaeche ordnet danach, ohne
    # die Reihenfolge der Raenge selbst zu kennen.
    rank_order: int = Field(validation_alias="rangfolge", serialization_alias="rangfolge")
    slug: str
    name: str
    # Leer, wo keine Quelle einen fuehrt. Dann steht der lateinische Name schon
    # in ``name``, und die Oberflaeche zeigt ihn nur einmal.
    latin_name: str | None = Field(
        validation_alias="lateinisch", serialization_alias="lateinisch", default=None
    )


class Color(StrEnum):
    """Die sechs Farben aus den Mockups. Eine freie Farbwahl gibt es nicht."""

    GREEN = "gruen"
    BROWN = "braun"
    BLUE = "blau"
    RED = "rot"
    GOLD = "gold"
    GREY = "grau"


# Jede Koordinate des Dienstes liegt in Deutschland. Die Grenzen stehen einmal
# in ``app.shared.geometrie``, damit Punkt und Polygon dieselbe Regel tragen.
Latitude = Annotated[float, Field(ge=geometry.LAT_MIN, le=geometry.LAT_MAX)]
Longitude = Annotated[float, Field(ge=geometry.LON_MIN, le=geometry.LON_MAX)]


def _not_in_the_future(value: date) -> date:
    # Ein Fund, den es noch nicht gibt, ist keiner. Gerechnet wird in UTC, weil
    # der Dienst keine Zeitzone des Geraets kennt.
    if value > datetime.now(UTC).date():
        raise ValueError("Das Datum liegt in der Zukunft.")
    return value


FindDate = Annotated[date, AfterValidator(_not_in_the_future)]

Name = Annotated[str, Field(min_length=1, max_length=80)]
Note = Annotated[str, Field(max_length=2000)]
Count = Annotated[int, Field(ge=1, le=10_000)]


class GeoPolygon(BaseSchema):
    """Eine Flaeche als GeoJSON, mit genau einem Ring und ohne Loecher.

    Der Ring kommt offen oder geschlossen herein und geht immer geschlossen
    heraus. Punkte in umgekehrter Richtung sind erlaubt; die Flaeche rechnet mit
    dem Betrag.
    """

    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[tuple[Longitude, Latitude]]] = Field(min_length=1, max_length=1)

    @property
    def ring(self) -> list[geometry.Point]:
        """Der geschlossene Ring der Flaeche."""
        return list(self.coordinates[0])

    @model_validator(mode="after")
    def _check_ring(self) -> "GeoPolygon":
        closed = geometry.close_ring(self.coordinates[0])
        if not geometry.is_simple(closed):
            raise ValueError("Die Flaeche ueberschneidet sich selbst.")
        if geometry.area_ha(closed) <= 0:
            raise ValueError("Die Eckpunkte liegen auf einer Linie und spannen keine Flaeche auf.")
        self.coordinates = [closed]
        return self


# ------------------------------------------------------------ Das Vokabular der Arten
#
# Diese Aufzaehlungen stehen hier und nicht im Modul der Arten, weil beide
# Seiten sie brauchen: der Vertrag in ``app/modules/species/schemas.py`` und
# die Tabellen in ``app/models.py``. Laegen sie im Modul, zoege ``app.models``
# beim Import dessen Paket mit und darueber den Router — ein Kreis. ``TaxonStep``
# steht aus demselben Grund schon hier.


class Group(StrEnum):
    """Die Verwandtschaft, mit der eine Art im Katalog steht."""

    BOLETE = "roehrling"
    ROUGH_STEMMED_BOLETE = "raufussroehrling"
    SLIPPERY_JACK = "schmierroehrling"
    CHANTERELLE = "leistling"
    HEDGEHOG = "stoppelpilz"
    MILKCAP = "milchling"
    BRITTLEGILL = "taeubling"
    PARASOL = "schirmling"
    AGARICUS = "champignon"
    INKCAP = "tintling"
    PUFFBALL = "staeubling"
    FUNNEL = "trichterling"
    BLEWIT = "roetelritterling"
    HONEY_FUNGUS = "hallimasch"
    SCALYCAP = "schueppling"
    TOUGHSHANK = "ruebling"
    PORCELAIN = "schleimruebling"
    OYSTER = "seitling"
    LIONS_MANE = "stachelbart"
    POLYPORE = "porling"
    CAULIFLOWER = "glucke"
    KNIGHT = "ritterling"
    PARACHUTE = "schwindling"
    WOODWAX = "schneckling"
    AMANITA = "wulstling"
    MOREL = "morchel"
    JELLY_EAR = "ohrlappenpilz"
    SPIKE = "gelbfuss"
    WEBCAP = "schleierling"
    DOMECAP = "rasling"
    PINKGILL = "roetling"
    SPINE_FUNGUS = "stachelpilz"
    CUP_FUNGUS = "becherling"


class Season(StrEnum):
    """Wann eine Art fruchtet."""

    SPRING = "fruehling"
    SUMMER = "sommer"
    AUTUMN = "herbst"
    WINTER = "winter"


class TreeSpecies(StrEnum):
    """Der Baum, an dem eine Art waechst. Leer bei Zersetzern ohne Wirt."""

    SPRUCE = "fichte"
    PINE = "kiefer"
    FIR = "tanne"
    LARCH = "laerche"
    DOUGLAS_FIR = "douglasie"
    BEECH = "buche"
    OAK = "eiche"
    BIRCH = "birke"
    ALDER = "erle"
    BLACK_LOCUST = "robinie"
    YEW = "eibe"
    LABURNUM = "goldregen"
    BILBERRY = "heidelbeere"
    HOLM_OAK = "steineiche"
    HORNBEAM = "hainbuche"
    HAZEL = "hasel"
    POPLAR = "pappel"
    WILLOW = "weide"
    LIME = "linde"
    ASH = "esche"
    ELM = "ulme"
    MAPLE = "ahorn"
    CHESTNUT = "kastanie"
    ELDER = "holunder"
    FRUIT_TREE = "obstbaum"


class Edibility(StrEnum):
    """Wie gefaehrlich eine Art in der Pfanne ist. Fuenf Stufen, mehr nicht.

    Die Stufe kommt allein aus der Auszeichnung im Kopf der Quellseite.
    Garzeiten, Rohgiftigkeit und Unvertraeglichkeiten stehen im
    ``speisewertHinweis``: sie sagen, wie man die Art zubereitet, nicht ob man
    sie essen darf.

    Wie gut eine essbare Art schmeckt, ist keine Stufe der Gefahr. Das steht
    als ``wertigkeit`` im Profil, mit derselben Zahl wie auf der Quellseite.
    """

    EDIBLE = "essbar"
    EDIBLE_WHEN_COOKED = "bedingtEssbar"
    INEDIBLE = "ungeniessbar"
    POISONOUS = "giftig"
    DEADLY = "toedlichGiftig"


class ProtectionStatus(StrEnum):
    """Der Schutz nach Bundesartenschutzverordnung."""

    NONE = "keiner"
    SPECIAL = "besondersGeschuetzt"
    STRICT = "strengGeschuetzt"


class RedListStatus(StrEnum):
    """Die Stufe der Roten Liste Deutschlands, wenn die Quellseite eine nennt."""

    CRITICALLY_ENDANGERED = "vomAussterbenBedroht"
    ENDANGERED = "starkGefaehrdet"
    VULNERABLE = "gefaehrdet"
    UNKNOWN_EXTENT = "unbekanntesAusmass"
    EXTREMELY_RARE = "extremSelten"
    NEAR_THREATENED = "vorwarnliste"
    DATA_DEFICIENT = "datenUnzureichend"


class Frequency(StrEnum):
    """Wie oft man die Art findet, laut ihrer Quellseite."""

    VERY_COMMON = "sehrHaeufig"
    COMMON = "haeufig"
    SCATTERED = "zerstreut"
    RARE = "selten"
    VERY_RARE = "sehrSelten"


class Unit(StrEnum):
    """Die Einheit einer Messung. Sie steht am Wert, nicht im Feldnamen."""

    CM = "cm"
    MM = "mm"
    UM = "um"


class ChangeSpeed(StrEnum):
    """Wie schnell eine Verfaerbung eintritt."""

    FAST = "schnell"
    SLOW = "langsam"


class Reagent(StrEnum):
    """Die Chemikalien, mit denen ein Bestimmer eine Farbreaktion auslöst."""

    KOH = "koh"
    NAOH = "naoh"
    FESO4 = "feso4"
    GUAIAC = "guajak"
    MELZER = "melzer"
    ANILINE = "anilin"
    PHENOL = "phenol"
    AMMONIA = "ammoniak"
    SULFOVANILLIN = "sulfovanillin"
    FORMALIN = "formalin"
    FECL3 = "fecl3"
    WIELAND = "wieland"
    SCHAEFFER = "schaeffer"


class TraitKey(StrEnum):
    """Die Zeilen der Merkmalstabelle.

    Die Reihenfolge hier ist die Reihenfolge auf der Artseite: erst der
    Fruchtkoerper, dann das Sporenlager, dann Stiel und Fleisch, zuletzt
    Standort und Zeit.
    """

    FRUITBODY = "fruchtkoerper"
    CAP = "hut"
    TUBES = "roehren"
    GILLS = "lamellen"
    FOLDS = "leisten"
    SPINES = "stacheln"
    PORES = "poren"
    MILK = "milch"
    STEM = "stiel"
    FLESH = "fleisch"
    SMELL = "geruch"
    TASTE = "geschmack"
    SPORE_PRINT = "sporenpulver"
    REAGENTS = "reagenzien"
    HABITAT = "vorkommen"
    SEASON = "zeit"
    EDIBILITY = "speisewert"
    PROTECTION = "schutz"


class Tier(StrEnum):
    """Was die App zu einer Art zeigen kann. Die Datenlage entscheidet.

    Eine Verwechslung ist keine Stufe. Sie ist eine Beziehung zwischen zwei
    Arten und steht in ``verwechslungen``, nicht als Eigenschaft einer Art.
    """

    FORECAST = "vorhersage"
    SEASON = "saison"
    PROFILE = "profil"


class HymenophoreKind(StrEnum):
    """Woran die Sporen sitzen. Ein Fruchtkoerper hat genau eine dieser Formen.

    Die Liste kommt aus den Quellseiten und nicht aus dem Kopf: 177 Seiten
    fuehren eine Zeile "Lamellen", 64 "Roehren", 10 "Poren", 9 "Leisten" und
    6 "Stacheln". Poren stehen als eigener Wert, weil die Porlinge sie von den
    Roehren der Roehrlinge trennen; die Merkmalstabelle tut das schon.
    """

    GILLS = "lamellen"
    TUBES = "roehren"
    PORES = "poren"
    SPINES = "stacheln"
    FOLDS = "leisten"


class GillAttachment(StrEnum):
    """Wie die Lamellen den Stiel treffen. Das trennt den Champignon vom Wulstling."""

    FREE = "frei"
    ADNATE = "angewachsen"
    EMARGINATE = "ausgebuchtet"
    DECURRENT = "herablaufend"


class GillSpacing(StrEnum):
    """Wie dicht die Lamellen stehen."""

    CLOSE = "eng"
    NORMAL = "normal"
    DISTANT = "weit"


class GillEdge(StrEnum):
    """Wie die Schneide einer Lamelle aussieht."""

    SMOOTH = "glatt"
    SERRATE = "gesaegt"
    CILIATE = "bewimpert"


class CapShape(StrEnum):
    """Der Umriss des Hutes oder Fruchtkoerpers.

    Die Liste ist gezaehlt, nicht erfunden. So viele der 305 Quellseiten nennen
    den Umriss samt seiner Varianten: flach 41, gewoelbt 34, trichterfoermig
    27, halbkugelig 26, kegelig 11, muschelfoermig 11, glockig 9, eifoermig 9,
    kugelig 7, birnenfoermig 5, niedergedrueckt 3, keulig 2, zylindrisch 2.

    Die letzten drei stehen selten da und bleiben trotzdem: ein Umriss, den die
    Quelle nennt und wir verschweigen, ist eine Luecke. Was kein Umriss ist,
    steht als ``CapFeature`` daneben.
    """

    HEMISPHERICAL = "halbkugelig"
    CONVEX = "gewoelbt"
    FLAT = "flach"
    DEPRESSED = "niedergedrueckt"
    FUNNEL = "trichterfoermig"
    CONICAL = "kegelig"
    BELL = "glockig"
    EGG = "eifoermig"
    SPHERICAL = "kugelig"
    SHELL = "muschelfoermig"
    PEAR = "birnenfoermig"
    CLUB = "keulig"
    CYLINDRICAL = "zylindrisch"


class CapFeature(StrEnum):
    """Was zu einem Umriss dazukommt, ohne selbst einer zu sein.

    ``gebuckelt`` ist mit 53 Seiten der haeufigste Begriff im Hut-Feld und
    steht fast nie allein: "flach gewoelbt mit Buckel" ist eine Form plus einen
    Zusatz. Dazu hygrophan 25, gezont 20, vertieft 20, unregelmaessig 13,
    genabelt 10.
    """

    UMBONATE = "gebuckelt"
    HYGROPHANOUS = "hygrophan"
    ZONED = "gezont"
    SUNKEN = "vertieft"
    IRREGULAR = "unregelmaessig"
    NAVELLED = "genabelt"


class CapMargin(StrEnum):
    """Der Rand des Hutes. Er aendert sich mit dem Alter wie der Hut selbst.

    Gezaehlt: eingerollt 58, wellig 30, gerieft 30, gerissen 28, fransig 19,
    eingebogen 16, ueberstehend 13, scharf 12, hoeckerig 10. "Glatt" faellt mit
    5 heraus; es ist ohnehin die Abwesenheit der anderen.
    """

    INROLLED = "eingerollt"
    WAVY = "wellig"
    STRIATE = "gerieft"
    CRACKED = "gerissen"
    FRINGED = "fransig"
    INCURVED = "eingebogen"
    OVERHANGING = "ueberstehend"
    SHARP = "scharf"
    LOBED = "hoeckerig"


class StemFeature(StrEnum):
    """Was ein Stiel traegt. Mehreres zugleich: ein Ring schliesst eine Knolle nicht aus.

    Gezaehlt ueber 291 Seiten mit einem Stiel-Feld: Ring 72, Knolle 72, hohl
    68, faserig 66, beflockt 57, voll 41, genattert 33, genetzt 25, behaart 17,
    wurzelnd 16, gerieft 13, Scheide 11, bruechig 10.
    """

    RING = "ring"
    BULB = "knolle"
    HOLLOW = "hohl"
    FIBROUS = "faserig"
    FLOCKED = "beflockt"
    SOLID = "voll"
    BANDED = "genattert"
    NETTED = "genetzt"
    HAIRY = "behaart"
    ROOTING = "wurzelnd"
    STRIATE = "gerieft"
    VOLVA = "scheide"
    BRITTLE = "bruechig"

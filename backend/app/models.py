"""Tabellen der App. Die Baseline-Migration baut das Schema aus diesen Modellen."""

from datetime import UTC, date, datetime
from enum import Enum, StrEnum
from typing import Final
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Dialect,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
)
from sqlalchemy import Enum as SaEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.shared.schemas import (
    CapFeature,
    CapMargin,
    CapShape,
    ChangeSpeed,
    Color,
    Edibility,
    Frequency,
    GillAttachment,
    GillEdge,
    GillSpacing,
    Group,
    HymenophoreKind,
    ImageState,
    Licence,
    ProtectionStatus,
    Reagent,
    RedListStatus,
    Rule,
    Season,
    StemFeature,
    TaxonRank,
    TraitKey,
    TreeSpecies,
    Unit,
    Visibility,
)

# Eine UUID als Zeichenkette. Das Geraet vergibt sie schon offline, damit ein
# Eintrag aus der Warteschlange dieselbe Kennung behaelt.
ID_LENGTH: Final = 36


def new_identifier() -> str:
    """Eine neue Objektkennung."""
    return str(uuid4())


def utc_now() -> datetime:
    """Der aktuelle Zeitpunkt, immer mit Zeitzone."""
    return datetime.now(UTC)


def _values(enumeration: type[Enum]) -> list[str]:
    # Ohne das legt SQLAlchemy die Namen der Glieder ab. In der Spalte soll der
    # Wert stehen, den auch das JSON traegt.
    return [str(member.value) for member in enumeration]


def _enum_column(enumeration: type[Enum], length: int = 16) -> SaEnum:
    """Eine Aufzaehlung als Textspalte mit Pruefung, so wie SQLite sie kann.

    Die Laenge ist die des laengsten Werts, aufgerundet. Sie steht nicht
    automatisch da, weil eine gewachsene Spalte sie nicht mehr aendern soll:
    ein neuer, laengerer Wert waere sonst still eine Schemaaenderung.
    """
    return SaEnum(enumeration, native_enum=False, length=length, values_callable=_values)


class UtcTime(TypeDecorator[datetime]):
    """Ein Zeitpunkt, der aus SQLite wieder mit Zeitzone herauskommt.

    SQLite hat keinen Zeittyp. Der Treiber gibt einen Zeitpunkt ohne Zeitzone
    zurueck, und der vergleicht sich falsch gegen einen bewussten. Diese Spalte
    schreibt in UTC und haengt UTC beim Lesen wieder an.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:  # noqa: ARG002
        """Legt den Zeitpunkt in UTC ab."""
        return None if value is None else value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:  # noqa: ARG002
        """Liest den Zeitpunkt als UTC zurueck."""
        return None if value is None else value.replace(tzinfo=UTC)


class Base(DeclarativeBase):
    """Gemeinsame Wurzel aller Tabellen."""


# Wie ein Verweis auf ``user`` reagiert, wenn das Konto verschwindet.
#
# ``RESTRICT`` traegt alles, was jemand angelegt hat und was ohne ihn weiter
# gilt: Funde, Marker, Zonen, Kombinationen und eingereichte Bilder. Ein
# geloeschtes Konto darf sie nicht stillschweigend mitreissen. Heute loescht
# der Dienst kein Konto; wer das baut, stoesst an diese Sperre und muss je
# Tabelle entscheiden, was mit dem Bestand geschieht. Genau diese Entscheidung
# soll er treffen muessen.
OWNED_BY_PERSON: Final = "RESTRICT"


def person_key(table: str, column: str) -> str:
    """Der Name einer Bedingung auf ``user.sub``.

    Ein Name ist noetig, weil SQLite eine Bedingung nur ueber ihn wiederfindet:
    die Migration muss wissen, ob sie schon steht, und ein spaeterer Schritt
    muss sie loesen koennen.
    """
    return f"fk_{table}_{column}_user"


# ``SET NULL`` traegt die wahlfreien Spuren einer Handlung. Der geprueften
# Aufnahme bleibt ihr Zustand, dem Text sein Wortlaut; nur der Name dahinter
# faellt weg. Ein Verbot haette hier nichts zu schuetzen.
TRACE_OF_PERSON: Final = "SET NULL"

# Die acht Spalten, die auf ein Konto zeigen, mit ihrer Loeschregel. Migration
# und Zaehlwerkzeug lesen daraus, damit die Liste an einer Stelle steht.
PERSON_KEYS: Final[tuple[tuple[str, str, str], ...]] = (
    ("find", "owner_sub", OWNED_BY_PERSON),
    ("marker", "owner_sub", OWNED_BY_PERSON),
    ("zone", "owner_sub", OWNED_BY_PERSON),
    ("combination", "owner_sub", OWNED_BY_PERSON),
    ("species_image", "uploader_sub", OWNED_BY_PERSON),
    ("species_image", "reviewed_by", TRACE_OF_PERSON),
    ("text", "updated_by", TRACE_OF_PERSON),
    ("user_role", "user_sub", "CASCADE"),
)


# Die zwei Spalten, die auf eine Art zeigen, mit dem Namen ihrer Bedingung.
# Wie ``PERSON_KEYS``: Migration und Zaehlwerkzeug lesen daraus, damit die
# Liste nicht an zwei Stellen steht.
#
# ``RESTRICT``: eine Art verschwindet nicht, solange ein Fund sie nennt. Wer
# eine Art aus dem Katalog nimmt, muss entscheiden, was mit den Funden wird.
SPECIES_KEYS: Final[tuple[tuple[str, str], ...]] = (
    ("find", "species_slug"),
    ("species_image", "species_slug"),
)


def species_key(table: str, column: str) -> str:
    """Der Name einer Bedingung auf ``species.slug``."""
    return f"fk_{table}_{column}_species"


class Person(Base):
    """Ein Konto. Es entsteht beim ersten Zugriff, erkannt am ``sub`` des Tokens.

    ``app.core.auth.User`` ist die Person im Token, diese Zeile ist ihr
    Gedächtnis. Nur so weiß die Rollenverwaltung, wen es überhaupt gibt: das
    SSO gibt keine Liste heraus.
    """

    __tablename__ = "user"

    sub: Mapped[str] = mapped_column(String(255), primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255), default=None)
    name: Mapped[str | None] = mapped_column(String(255), default=None)
    created_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now)


class Role(Base):
    """Eine Rolle. Zwei stehen fest, alles Weitere legt jemand mit dem Recht an."""

    __tablename__ = "role"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, default=new_identifier)
    # Der Slug trägt die Bedeutung, der Name nur die Beschriftung. Nur so
    # bleiben die festen Rollen erkennbar, auch wenn jemand sie umbenennt.
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    built_in: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now, onupdate=utc_now)


class PermissionRow(Base):
    """Ein Recht in der Datenbank.

    Der Katalog steht im Code, in ``app.modules.access.permissions``. Diese
    Tabelle spiegelt ihn, damit ``role_permission`` einen Fremdschlüssel hat
    und ein Recht nicht als Tippfehler in einer Rolle landet. Der Dienst
    gleicht sie beim Start ab.
    """

    __tablename__ = "permission"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    area: Mapped[str] = mapped_column(String(20))


class RolePermission(Base):
    """Ein Recht an einer Rolle."""

    __tablename__ = "role_permission"

    role_id: Mapped[str] = mapped_column(
        ForeignKey("role.id", ondelete="CASCADE"),
        primary_key=True,
    )
    permission_key: Mapped[str] = mapped_column(
        ForeignKey("permission.key", ondelete="CASCADE"),
        primary_key=True,
    )


class UserRole(Base):
    """Eine Rolle an einer Person. Die feste Rolle ``user`` steht hier nie.

    Sie gilt jeder angemeldeten Person, und eine Zeile je Konto wäre eine
    Zeile, die nichts sagt.
    """

    __tablename__ = "user_role"

    # ``CASCADE``: eine Rolle an einem Konto, das es nicht mehr gibt, sagt
    # nichts und traegt nichts. Sie geht mit, wie sie mit der Rolle mitgeht.
    user_sub: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("user.sub", ondelete="CASCADE", name=person_key("user_role", "user_sub")),
        primary_key=True,
        index=True,
    )
    role_id: Mapped[str] = mapped_column(
        ForeignKey("role.id", ondelete="CASCADE"),
        primary_key=True,
    )
    granted_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now)


class Term(Base):
    """Ein Begriff aus einem verwalteten Katalog: Geruch, Geschmack, Baumart.

    Diese Werte stehen nicht als Enum im Code. Die Verwaltung muss sie
    erweitern koennen, und ein neuer Geruch soll eine Zeile sein, kein Deploy.
    Der Slug steht in den Profilen, der Name nur hier.
    """

    __tablename__ = "term"
    __table_args__ = (UniqueConstraint("kind", "slug", name="uq_term_kind_slug"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), index=True)
    slug: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(120))
    position: Mapped[int] = mapped_column(Integer, default=0)


class Taxon(Base):
    """Eine Stufe der Einordnung: Abteilung, Klasse, Ordnung, Familie, Gattung.

    Eine Tabelle fuer alle Raenge, verkettet ueber ``parent_id`` auf sich
    selbst und leer an der Wurzel. Ein Rang mehr ist damit eine Zeile und kein
    Umbau, und eine Art darf an jeder Stufe haengen: ist die Gattung strittig,
    traegt die Familie sie. Eine Art ohne Stufe ist noch nicht eingeordnet.
    Nicht einzuordnen gibt es nicht: jede Art hat eine Stellung, wir kennen sie
    nur nicht immer.

    Der Anfangsbestand kommt aus ``daten/taxonomie.json``. Danach ist diese
    Tabelle die Wahrheit, und der Start gleicht nur noch ab.
    """

    __tablename__ = "taxon"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, default=new_identifier)
    rank: Mapped[TaxonRank] = mapped_column(_enum_column(TaxonRank), index=True)
    # Wie tief der Rang steht, oben null. Die Zahl steht in der Zeile und nicht
    # in der Reihenfolge des Enums: ein Rang, den jemand dazwischen setzt,
    # schriebe sonst jede vorhandene Zeile um.
    rank_order: Mapped[int] = mapped_column(Integer)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    # Leer, wo keine Quelle einen fuehrt. Geraten wird nichts.
    latin_name: Mapped[str | None] = mapped_column(String(120), default=None)
    parent_id: Mapped[str | None] = mapped_column(
        ForeignKey("taxon.id", ondelete="RESTRICT"), default=None, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, default=None)

    parent: Mapped["Taxon | None"] = relationship(remote_side="Taxon.id", back_populates="children")
    children: Mapped[list["Taxon"]] = relationship(back_populates="parent")


class UiText(Base):
    """Ein Text der Oberflaeche, je Schluessel und Sprache eine Zeile.

    Der Anfangsbestand kommt aus ``daten/texte.json``. Danach ist diese Tabelle
    die einzige Wahrheit: der eingebaute Katalog des Frontends dient nur noch
    dem ersten Start und dem Betrieb ohne Netz.
    """

    __tablename__ = "text"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    locale: Mapped[str] = mapped_column(String(5), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now, onupdate=utc_now)
    # Wer zuletzt geschrieben hat. Leer heisst: so kam der Text aus der Vorgabe.
    updated_by: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey("user.sub", ondelete=TRACE_OF_PERSON, name=person_key("text", "updated_by")),
        default=None,
    )


class Owned(Base):
    """Was einem Konto gehoert: Kennung, Besitzer und die beiden Zeitpunkte.

    Der Besitzer ist der ``sub`` aus dem Token. Er kommt nie aus dem Koerper
    einer Anfrage. Die Besitzerpruefung in ``app/shared/objects.py`` haengt an
    dieser Stufe, damit sie fuer jedes eigene Objekt gilt.
    """

    __abstract__ = True

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, default=new_identifier)

    @declared_attr
    @classmethod
    def owner_sub(cls) -> Mapped[str]:
        """Der Besitzer, je Tabelle mit eigenem Namen der Bedingung.

        Der Name muss die Tabelle nennen: vier Tabellen erben diese Spalte, und
        zwei Bedingungen desselben Namens gaebe es nicht.
        """
        return mapped_column(
            String(255),
            ForeignKey(
                "user.sub",
                ondelete=OWNED_BY_PERSON,
                name=person_key(cls.__tablename__, "owner_sub"),
            ),
            index=True,
        )

    created_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now, onupdate=utc_now)


class MapObject(Owned):
    """Was auf der Karte liegt: Fund, Marker und Zone tragen zusaetzlich diese Felder."""

    __abstract__ = True

    visibility: Mapped[Visibility] = mapped_column(
        _enum_column(Visibility),
        default=Visibility.PRIVATE,
    )
    note: Mapped[str | None] = mapped_column(Text, default=None)


class Find(MapObject):
    """Ein gemeldeter Fund: eine Art an einem Ort an einem Tag."""

    __tablename__ = "find"

    # Der Anzeigename friert beim Speichern ein. Ein spaeterer Namenswechsel im
    # SSO soll einen geteilten Fund nicht rueckwirkend umschreiben.
    owner_name: Mapped[str | None] = mapped_column(String(255), default=None)
    # Leer heisst: die Art ist unbekannt. Wer einen Fund meldet, den er nicht
    # bestimmen kann, soll ihn trotzdem eintragen duerfen; ein geratener Slug
    # waere schlechter als keiner.
    species_slug: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("species.slug", ondelete="RESTRICT", name=species_key("find", "species_slug")),
        default=None,
        index=True,
    )
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    found_on: Mapped[date] = mapped_column(Date, index=True)
    count: Mapped[int | None] = mapped_column(default=None)
    # Wer das setzt, gibt den genauen Fundort an die Kette weiter. Die Vorgabe
    # ist darum nein, und nur der Besitzer kann sie aendern.
    # Ohne Index: die Kette liest die Liste einmal je Lauf, und eine Spalte
    # mit zwei Werten hilft SQLite dabei nicht.
    for_training: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    photos: Mapped[list["Photo"]] = relationship(
        back_populates="find",
        cascade="all, delete-orphan",
        # Die Fundliste zeigt die Fotos mit. Ohne Vorladen liefe jeder Zugriff
        # in eine spaete Abfrage, die es unter asyncio nicht gibt.
        lazy="selectin",
        order_by="Photo.created_at",
    )


class Photo(Base):
    """Ein Bild zu einem Fund. Die Datei liegt unter ``PILZE_FOTOS``."""

    __tablename__ = "photo"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, default=new_identifier)
    find_id: Mapped[str] = mapped_column(ForeignKey("find.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(64))
    width: Mapped[int] = mapped_column()
    height: Mapped[int] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now)

    find: Mapped[Find] = relationship(back_populates="photos")


class SpeciesImage(Base):
    """Ein Bild zu einer Art. Die Dateien liegen unter ``PILZE_FOTOS/arten``.

    Die Art steht als Slug und nicht als Fremdschluessel: der Artenkatalog ist
    kein Tabelleninhalt, er kommt als TOML mit dem Deploy.

    ``photographer`` und ``licence`` sind Pflicht. Ein Bild ohne Urheber ist
    eines, das die App nicht zeigen darf.
    """

    __tablename__ = "species_image"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, default=new_identifier)
    # Der Verweis bleibt Pflicht, anders als beim Fund. Ein Artbild ohne Art
    # gibt es heute nicht: der Endpunkt verlangt sie, und keine Zeile kann sie
    # verlieren. Wahlfrei wird die Spalte mit R4c, wenn diese Tabelle und
    # ``photo`` eine werden und ein Fundfoto ohne bestimmte Art dazukommt. Bis
    # dahin waeren vier Abfragen auf einen Fall, den es nicht gibt, toter Code.
    species_slug: Mapped[str] = mapped_column(
        String(80),
        ForeignKey(
            "species.slug", ondelete="RESTRICT", name=species_key("species_image", "species_slug")
        ),
        index=True,
    )
    uploader_sub: Mapped[str] = mapped_column(
        String(255),
        ForeignKey(
            "user.sub", ondelete=OWNED_BY_PERSON, name=person_key("species_image", "uploader_sub")
        ),
        index=True,
    )
    photographer: Mapped[str] = mapped_column(String(120))
    licence: Mapped[Licence] = mapped_column(_enum_column(Licence))
    source: Mapped[str | None] = mapped_column(Text, default=None)
    taken_on: Mapped[date | None] = mapped_column(Date, default=None)
    caption: Mapped[str | None] = mapped_column(String(200), default=None)
    # Der Ort der Aufnahme, wahlfrei. Er steht hier nur auf dem Raster: der
    # Dienst rundet vor dem Schreiben und kennt den genauen Punkt nie.
    lat: Mapped[float | None] = mapped_column(Float, default=None)
    lon: Mapped[float | None] = mapped_column(Float, default=None)
    # Das Titelbild einer Art. Hoechstens eines traegt es, das setzt der Dienst
    # beim Schreiben durch.
    lead: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    state: Mapped[ImageState] = mapped_column(
        _enum_column(ImageState),
        default=ImageState.SUBMITTED,
        index=True,
    )
    # Der Grund einer Absage. Er geht an die einreichende Person zurueck.
    reject_reason: Mapped[str | None] = mapped_column(String(200), default=None)
    reviewed_by: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey(
            "user.sub", ondelete=TRACE_OF_PERSON, name=person_key("species_image", "reviewed_by")
        ),
        default=None,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(UtcTime, default=None)
    width: Mapped[int] = mapped_column()
    height: Mapped[int] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(UtcTime, default=utc_now, onupdate=utc_now)


class Marker(MapObject):
    """Eine gemerkte Stelle auf der Karte."""

    __tablename__ = "marker"

    name: Mapped[str] = mapped_column(String(80))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    color: Mapped[Color] = mapped_column(_enum_column(Color), default=Color.GREEN)


class Zone(MapObject):
    """Ein Revier als Flaeche. Die Karte gibt ihr einen Wert je Woche zurueck."""

    __tablename__ = "zone"

    name: Mapped[str] = mapped_column(String(80))
    # GeoJSON als Text. SQLite hat keinen Geometrietyp, und der Dienst rechnet
    # die Flaeche selbst.
    polygon: Mapped[str] = mapped_column(Text)
    area_ha: Mapped[float] = mapped_column(Float)
    color: Mapped[Color] = mapped_column(_enum_column(Color), default=Color.GREEN)


class Combination(Owned):
    """Ein gespeicherter Faktor-Finder: eine Regel und ihre Faktoren.

    Die Faktoren liegen als GeoJSON-fremdes JSON in einer Textspalte. Sie sind
    eine Liste ohne eigene Abfrage: niemand sucht nach einem Faktor, und eine
    zweite Tabelle waere nur ein Verbund mehr je Zeile.
    """

    __tablename__ = "combination"

    name: Mapped[str] = mapped_column(String(80))
    rule: Mapped[Rule] = mapped_column(_enum_column(Rule), default=Rule.INTERSECTION)
    factors: Mapped[str] = mapped_column(Text)


# --------------------------------------------------------------- Der Artenkatalog
#
# Die Profile lagen bis R4b nur als TOML neben dem Code. Jetzt tragen sie eine
# Tabelle mit Kindtabellen, wie im Zieldiagramm. Die Dateien bleiben der
# Anfangsbestand, so wie ``daten/texte.json`` es fuer die Oberflaechentexte ist:
# die Wanderung liest sie ein, danach ist die Tabelle die Wahrheit.
#
# Diese Tabellen heissen englisch, anders als ihre aelteren Nachbarn. Das
# Zielmodell nennt sie so, und R4d benennt ohnehin den Rest um; deutsche Namen
# waeren zwei Umbenennungen statt einer.


class NameKind(StrEnum):
    """Warum ein Name neben dem Hauptnamen steht."""

    COMMON = "weiterer"
    SYNONYM = "synonym"


class BodyPart(StrEnum):
    """Der Teil des Pilzes, den eine Messung oder eine Farbe meint."""

    CAP = "hut"
    FRUITBODY = "fruchtkoerper"
    HYMENIUM = "sporenlager"
    STEM = "stiel"
    FLESH = "fleisch"
    SPORE_PRINT = "sporenpulver"
    SPORE = "spore"


class Dimension(StrEnum):
    """Welche Strecke eine Messung nennt."""

    WIDTH = "breite"
    HEIGHT = "hoehe"
    LENGTH = "laenge"
    THICKNESS = "dicke"


class ChangePart(StrEnum):
    """Die zwei Seiten einer Verfaerbung: die Farbe vorher und die danach."""

    FROM = "von"
    TO = "nach"


class SourceScope(StrEnum):
    """Wofuer eine Quelle steht.

    ``profil`` ist die Seite, gegen die das Profil geprueft wurde. Sie traegt
    als einzige ein Pruefdatum. ``weiterfuehrend`` sind die Links, die die
    Artseite unter den Merkmalen nennt.
    """

    PROFILE = "profil"
    FURTHER = "weiterfuehrend"


class Phase(StrEnum):
    """Wann ein Merkmal gilt. Leer heisst: durchgehend.

    Die Quelle schreibt oft "jung voll, spaeter hohl". Ohne diese Spalte waere
    das entweder ein Widerspruch oder eine halbe Aussage.
    """

    YOUNG = "jung"
    OLD = "alt"


class SpeciesRow(Base):
    """Eine Art. Die Zeile heisst ``SpeciesRow``, weil ``Species`` der Vertrag ist.

    Alles, was genau einmal je Art vorkommt, steht hier. Was mehrfach vorkommt,
    steht in einer Kindtabelle: Namen, Masse, Farben, Merkmale, Reagenzien,
    Quellen, Begriffe und Verwechslungen.
    """

    __tablename__ = "species"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, default=new_identifier)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    latin_name: Mapped[str] = mapped_column(String(120))
    group: Mapped[Group] = mapped_column(_enum_column(Group), index=True)
    edibility: Mapped[Edibility] = mapped_column(_enum_column(Edibility), index=True)
    collectable: Mapped[bool] = mapped_column(Boolean, default=True)
    marketable: Mapped[bool] = mapped_column(Boolean, default=False)
    # Leer heisst: die Quelle sagt nichts zur Schweizer Marktliste. Das ist
    # etwas anderes als "steht nicht darauf".
    marketable_switzerland: Mapped[bool | None] = mapped_column(Boolean, default=None)
    value_rating: Mapped[int | None] = mapped_column(Integer, default=None)
    frequency: Mapped[Frequency | None] = mapped_column(_enum_column(Frequency), default=None)
    red_list: Mapped[RedListStatus | None] = mapped_column(
        _enum_column(RedListStatus, 24), default=None
    )
    warning: Mapped[str | None] = mapped_column(Text, default=None)
    map_name: Mapped[str | None] = mapped_column(String(80), default=None)
    edibility_note: Mapped[str | None] = mapped_column(Text, default=None)
    protection_note: Mapped[str | None] = mapped_column(Text, default=None)
    protection: Mapped[ProtectionStatus] = mapped_column(_enum_column(ProtectionStatus, 24))
    # Die Fundstelle der Einstufung, als Zitat. Sie steht nicht in
    # ``species_source``: die Tabelle traegt Adressen, das hier ist ein Satz.
    protection_source: Mapped[str] = mapped_column(String(200))
    period_start_month: Mapped[int | None] = mapped_column(Integer, default=None)
    period_end_month: Mapped[int | None] = mapped_column(Integer, default=None)
    period_peak_month: Mapped[int | None] = mapped_column(Integer, default=None)
    smell_text: Mapped[str | None] = mapped_column(Text, default=None)
    taste_text: Mapped[str | None] = mapped_column(Text, default=None)
    hymenium_type: Mapped[HymenophoreKind | None] = mapped_column(
        _enum_column(HymenophoreKind), default=None, index=True
    )
    gill_attachment: Mapped[GillAttachment | None] = mapped_column(
        _enum_column(GillAttachment), default=None
    )
    gill_spacing: Mapped[GillSpacing | None] = mapped_column(
        _enum_column(GillSpacing), default=None
    )
    gill_edge: Mapped[GillEdge | None] = mapped_column(_enum_column(GillEdge), default=None)
    # Zwei Spalten statt einer Kindtabelle: die Form ist genau ein Umriss je
    # Phase, nie eine Liste. Der Hutrand ist es, darum hat er eine Tabelle.
    cap_shape_young: Mapped[CapShape | None] = mapped_column(_enum_column(CapShape), default=None)
    cap_shape_old: Mapped[CapShape | None] = mapped_column(_enum_column(CapShape), default=None)
    # Die Geschwindigkeit gehoert zur Verfaerbung, und die gibt es hoechstens
    # einmal je Art. Ihre Farben stehen in ``species_colour_change``.
    colour_change_speed: Mapped[ChangeSpeed | None] = mapped_column(
        _enum_column(ChangeSpeed), default=None
    )


def _species_key() -> Mapped[str]:
    """Der Verweis aufs Elternteil, wie ihn jede Kindtabelle traegt.

    ``CASCADE``: eine Farbe ohne ihre Art sagt nichts. Die Kinder gehen mit dem
    Profil, das ist der Unterschied zu allem, was einer Person gehoert.
    """
    return mapped_column(
        String(ID_LENGTH),
        ForeignKey("species.id", ondelete="CASCADE"),
        primary_key=True,
    )


class SpeciesChild(Base):
    """Was jede Kindtabelle des Profils teilt: der Verweis und die Reihenfolge.

    ``position`` haelt die Reihenfolge der Datei fest. Ohne sie kaeme eine Liste
    in beliebiger Folge zurueck, und der Vergleich gegen das Profil schluege
    fehl, obwohl nichts fehlt.
    """

    __abstract__ = True

    @declared_attr
    @classmethod
    def species_id(cls) -> Mapped[str]:
        """Der Verweis auf die Art."""
        return _species_key()

    position: Mapped[int] = mapped_column(Integer, primary_key=True)


class SpeciesName(SpeciesChild):
    """Ein weiterer Name oder ein Synonym. Der Hauptname steht an der Art."""

    __tablename__ = "species_name"

    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[NameKind] = mapped_column(_enum_column(NameKind))


class SpeciesMeasurement(Base):
    """Eine Spanne: Koerperteil, Strecke, unten, oben, Einheit.

    Teil und Strecke zusammen sind eindeutig, darum braucht diese Tabelle keine
    Reihenfolge: die Artseite ordnet die Zeilen selbst.
    """

    __tablename__ = "species_measurement"

    species_id: Mapped[str] = _species_key()
    part: Mapped[BodyPart] = mapped_column(_enum_column(BodyPart), primary_key=True)
    dimension: Mapped[Dimension] = mapped_column(_enum_column(Dimension), primary_key=True)
    low: Mapped[float] = mapped_column(Float)
    high: Mapped[float] = mapped_column(Float)
    rare_low: Mapped[float | None] = mapped_column(Float, default=None)
    rare_high: Mapped[float | None] = mapped_column(Float, default=None)
    unit: Mapped[Unit] = mapped_column(_enum_column(Unit))
    description: Mapped[str | None] = mapped_column(String(200), default=None)


class SpeciesColour(Base):
    """Eine Farbe an einem Koerperteil, in der Reihenfolge der Quelle."""

    __tablename__ = "species_colour"

    species_id: Mapped[str] = _species_key()
    part: Mapped[BodyPart] = mapped_column(_enum_column(BodyPart), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    hex: Mapped[str] = mapped_column(String(7))


class SpeciesColourChange(Base):
    """Eine Farbe der Verfaerbung, vor oder nach dem Schnitt.

    Wie schnell sie kommt, steht an der Art: es gibt hoechstens eine
    Verfaerbung je Profil, und eine Geschwindigkeit je Farbe waere erfunden.
    """

    __tablename__ = "species_colour_change"

    species_id: Mapped[str] = _species_key()
    part: Mapped[ChangePart] = mapped_column(_enum_column(ChangePart), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(60))
    hex: Mapped[str] = mapped_column(String(7))


class SpeciesCapFeature(SpeciesChild):
    """Ein Hutmerkmal, das kein Umriss ist. ``phase`` leer heisst durchgehend."""

    __tablename__ = "species_cap_feature"
    __table_args__ = (UniqueConstraint("species_id", "feature", name="uq_cap_feature"),)

    feature: Mapped[CapFeature] = mapped_column(_enum_column(CapFeature), index=True)
    phase: Mapped[Phase | None] = mapped_column(_enum_column(Phase), default=None)


class SpeciesCapMargin(SpeciesChild):
    """Ein Zustand des Hutrands. Derselbe Rand kann jung und alt vorkommen."""

    __tablename__ = "species_cap_margin"
    __table_args__ = (UniqueConstraint("species_id", "margin", "phase", name="uq_cap_margin"),)

    margin: Mapped[CapMargin] = mapped_column(_enum_column(CapMargin), index=True)
    phase: Mapped[Phase | None] = mapped_column(_enum_column(Phase), default=None)


class SpeciesStemFeature(SpeciesChild):
    """Was der Stiel traegt. ``phase`` traegt "jung voll, spaeter hohl"."""

    __tablename__ = "species_stem_feature"
    __table_args__ = (UniqueConstraint("species_id", "feature", name="uq_stem_feature"),)

    feature: Mapped[StemFeature] = mapped_column(_enum_column(StemFeature), index=True)
    phase: Mapped[Phase | None] = mapped_column(_enum_column(Phase), default=None)


class SpeciesReagent(SpeciesChild):
    """Eine Chemikalie und die Farbe, die sie hervorruft."""

    __tablename__ = "species_reagent"
    __table_args__ = (UniqueConstraint("species_id", "reagent", name="uq_species_reagent"),)

    reagent: Mapped[Reagent] = mapped_column(_enum_column(Reagent))
    reaction: Mapped[str] = mapped_column(Text)


class SpeciesTrait(Base):
    """Eine Zeile der Merkmalstabelle: der Satz zu Hut, Stiel, Fleisch und Rest.

    Der Schluessel ist eindeutig je Art, darum steht hier keine Reihenfolge:
    die Artseite ordnet nach ``TraitKey``, nicht nach der Datei.
    """

    __tablename__ = "species_trait"

    species_id: Mapped[str] = _species_key()
    key: Mapped[TraitKey] = mapped_column(_enum_column(TraitKey), primary_key=True)
    text: Mapped[str] = mapped_column(Text)


class SpeciesSource(SpeciesChild):
    """Eine Adresse zur Art: die geprueffte Quellseite oder ein weiterer Link."""

    __tablename__ = "species_source"

    scope: Mapped[SourceScope] = mapped_column(_enum_column(SourceScope))
    title: Mapped[str | None] = mapped_column(String(120), default=None)
    url: Mapped[str] = mapped_column(String(400))
    # Nur die geprueffte Quellseite traegt ein Datum. Ein weiterfuehrender Link
    # wird nicht Zeile fuer Zeile gegengelesen, und ein Datum daran waere eine
    # Behauptung ueber eine Pruefung, die niemand gemacht hat.
    checked_on: Mapped[str | None] = mapped_column(String(10), default=None)


class SpeciesSeason(SpeciesChild):
    """Eine Jahreszeit, in der die Art erscheint."""

    __tablename__ = "species_season"
    __table_args__ = (UniqueConstraint("species_id", "season", name="uq_species_season"),)

    season: Mapped[Season] = mapped_column(_enum_column(Season), index=True)


class SpeciesTree(SpeciesChild):
    """Ein Baumpartner der Art.

    ``from_experience`` trennt, was die Quellseite nennt, von dem, was das
    Projekt selbst beobachtet hat. Beides steht in denselben Chips, aber wer
    eine Angabe nachschlagen will, muss wissen, wo sie herkommt.
    """

    __tablename__ = "species_tree"
    __table_args__ = (UniqueConstraint("species_id", "tree", name="uq_species_tree"),)

    tree: Mapped[TreeSpecies] = mapped_column(_enum_column(TreeSpecies), index=True)
    from_experience: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())


class SpeciesTerm(SpeciesChild):
    """Ein Schlagwort zu Geruch oder Geschmack, aus dem Katalog ``term``.

    Diese Werte stehen nicht als Enum im Code: die Verwaltung darf einen Geruch
    hinzufuegen, ohne dass jemand deployt. Der Fremdschluessel sorgt dafuer,
    dass kein Tippfehler als Schlagwort durchgeht.
    """

    __tablename__ = "species_term"
    __table_args__ = (UniqueConstraint("species_id", "term_id", name="uq_species_term"),)

    term_id: Mapped[int] = mapped_column(ForeignKey("term.id", ondelete="RESTRICT"), index=True)


class SpeciesLookalike(SpeciesChild):
    """Ein Paar von Arten, die man verwechselt. Es steht einmal, gilt aber beidseitig.

    ``difference`` sagt, woran man die andere Art erkennt, ``own_difference``
    woran man diese hier erkennt. Der Dienst liefert das Paar aus beiden
    Richtungen; das ist keine zweite Zeile, sondern eine zweite Lesart.
    """

    __tablename__ = "species_lookalike"
    __table_args__ = (UniqueConstraint("species_id", "other_id", name="uq_species_lookalike"),)

    other_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("species.id", ondelete="CASCADE"), index=True
    )
    difference: Mapped[str] = mapped_column(Text)
    own_difference: Mapped[str | None] = mapped_column(Text, default=None)

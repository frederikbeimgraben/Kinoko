/**
 * Der Vertrag des Merkmalskatalogs, wie ihn
 * `backend/app/modules/species/schemas.py` festlegt.
 *
 * Zwei Zahlen stehen an jeder Gruppe, bevor jemand wählt. Die Abdeckung sagt,
 * für wie viele Arten die Quelle das Merkmal überhaupt nennt; die Zahl am Wert
 * sagt, wie viele Arten er trifft. Beide sind absolut über den ganzen Katalog
 * und hängen nicht am übrigen Filter: sie sagen, was eine Wahl kostet, bevor
 * jemand sie trifft.
 */

/** Die Gruppen des Filterblatts. Der Name steht im i18n-Katalog. */
export const FACET_KEYS = [
  'speisewert',
  'schutz',
  'stufe',
  'sammelbar',
  'sinne',
  'farbe',
  'masse',
  'zeitraum',
  'fruchtschicht',
  'stielmerkmale',
  'baeume',
  'wertigkeit',
  'hutrand',
  'haeufigkeit',
  'hutform',
  'hutmerkmale',
  'reagenzien',
  'gefaehrdung',
] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

/** Wie eine Gruppe gewählt wird. Die Oberfläche schaltet danach. */
export const FACET_KINDS = ['werte', 'schalter', 'teile', 'farben', 'spanne', 'zeitraum'] as const;
export type FacetKind = (typeof FACET_KINDS)[number];

/** Ein wählbarer Wert mit der Zahl der Arten, die er trifft. */
export interface FacetValue {
  wert: string;
  anzahl: number;
}

/** Ein Teil einer Gruppe: ein Körperteil, ein Sinn, ein Maß. */
export interface FacetPart {
  teil: string;
  beschrieben: number;
  werte: FacetValue[];
  einheit: string | null;
  /** Die Grenzen eines Maßes. Leer, wo keine Art eine Angabe trägt. */
  von: number | null;
  bis: number | null;
}

/** Eine Gruppe mit ihrer Abdeckung. Sie trägt Werte oder Teile, nie beides. */
export interface FacetGroup {
  schluessel: FacetKey;
  art: FacetKind;
  beschrieben: number;
  werte: FacetValue[];
  teile: FacetPart[];
}

/** Die Antwort auf `GET /api/arten/merkmale`, nach Abdeckung geordnet. */
export interface FacetCatalogue {
  arten: number;
  gruppen: FacetGroup[];
}

/** Wie viele Arten allein an einer Gruppe scheitern, weil die Angabe fehlt. */
export interface Gap {
  schluessel: FacetKey;
  anzahl: number;
}

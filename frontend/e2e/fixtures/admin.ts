/** Die Attrappen der Verwaltung für Boards und Flüsse. */

export const NOW = '2026-09-12T10:00:00+02:00';

/** Die Rechte, die jeden Punkt der Verwaltung zeigen. */
export const EVERY_RIGHT = [
  'text.edit',
  'image.review',
  'species.edit',
  'role.manage',
  'role.assign',
  'find.review',
  'run.manage',
  'group.manage',
];

/** Die Zähler des Bretts `Admin`. */
export const SUMMARY = {
  texts: 1284,
  photos: 312,
  photosPending: 4,
  species: 306,
  roles: 4,
  permissions: 12,
  people: 7,
  finds: 382,
  findsPending: 14,
  runs: 4,
  runsRunning: 1,
};

/** Eine leere Zählung der Verwaltung, für den Leerzustand. */
export const EMPTY_SUMMARY = {
  texts: 0,
  photos: 0,
  photosPending: 0,
  species: 0,
  roles: 0,
  permissions: 0,
  people: 0,
  finds: 0,
  findsPending: 0,
  runs: 0,
  runsRunning: 0,
};

/** Eine Rolle, so wie `/api/roles` sie liefert. */
export function role(
  slug: string,
  name: string,
  description: string,
  peopleCount: number,
  builtIn = false,
): Record<string, unknown> {
  return {
    id: `rolle-${slug}`,
    slug,
    name,
    description,
    builtIn,
    permissions: [],
    peopleCount,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** Die vier Rollen des Bretts `Roles`. */
export const ROLES = {
  items: [
    role('admin', 'Admin', 'Alle Rechte', 1, true),
    role('user', 'Nutzer', 'Hat jeder · lesen, eigene Einträge', 0, true),
    {
      ...role('advisor', 'Pilzberater', 'Arten und Bilder pflegen', 3),
      permissions: ['species.edit', 'image.submit', 'image.review'],
    },
    role('translator', 'Übersetzer', 'Texte ändern', 2),
  ],
  nextCursor: null,
};

/** Der Rechtekatalog, wie ihn `/api/permissions` liefert. */
export const CATALOGUE = [
  { key: 'species.edit', area: 'species' },
  { key: 'image.submit', area: 'species' },
  { key: 'image.review', area: 'species' },
  { key: 'text.edit', area: 'interface' },
  { key: 'role.manage', area: 'access' },
  { key: 'role.assign', area: 'access' },
  { key: 'find.review', area: 'data' },
  { key: 'run.manage', area: 'data' },
];

/** Ein Konto, so wie `/api/people` es liefert. */
export function person(
  slug: string,
  name: string,
  email: string,
  roleSlug: string,
  roleName: string,
): Record<string, unknown> {
  return {
    id: `person-${slug}`,
    sub: `sub-${slug}`,
    email,
    name,
    roles: [{ id: `rolle-${roleSlug}`, slug: roleSlug, name: roleName }],
    createdAt: NOW,
  };
}

/** Die vier Konten des Bretts `People`. */
export const PEOPLE = {
  items: [
    person('frederik', 'Frederik', 'frederik@beimgraben.net', 'admin', 'Admin'),
    person('jonas', 'Jonas', 'jonas@example.net', 'advisor', 'Pilzberater'),
    person('testerin', 'Testerin', 'test@example.net', 'user', 'Nutzer'),
    person('marie', 'Marie', 'marie@example.net', 'translator', 'Übersetzer'),
  ],
  nextCursor: null,
};

/** Die vier Arten des Bretts `AdminSpecies` mit ihren Zahlen. */
export const ADMIN_SPECIES: readonly {
  slug: string;
  name: string;
  latin: string;
  edibility: string;
  forecast: boolean;
}[] = [
  { slug: 'boletus-edulis', name: 'Steinpilz', latin: 'Boletus edulis', edibility: 'edible', forecast: true },
  {
    slug: 'imleria-badia',
    name: 'Maronenröhrling',
    latin: 'Imleria badia',
    edibility: 'edible',
    forecast: true,
  },
  {
    slug: 'neolentinus-cyathiformis',
    name: 'Becherförmiger Sägeblättling',
    latin: 'Neolentinus cyathiformis',
    edibility: 'inedible',
    forecast: true,
  },
  {
    slug: 'tricholoma-terreum',
    name: 'Erdritterling',
    latin: 'Tricholoma terreum',
    edibility: 'edible',
    forecast: false,
  },
];

/** Ein Schlüssel der Oberfläche, so wie `/api/texts` ihn liefert. */
export function text(key: string, de: string, en: string, changed = false): Record<string, unknown> {
  return { key, values: { de, en }, changed, updatedAt: NOW };
}

/** Die vier Schlüssel des Bretts `Texts`. */
export const TEXTS = {
  revision: 'e2e',
  locales: ['de', 'en'],
  entries: [
    text('karte.legende', 'Fundwahrscheinlichkeit je Begehung', 'Probability of a find per visit'),
    text('arten.chip.mitVorhersage', 'Mit Vorhersage', 'With forecast', true),
    text('eintraege.leer', 'Eigene Einträge stehen im Konto.', 'Your entries live in your account.'),
    text('melden.freigabe', 'Für das Training freigeben', 'Share for training'),
  ],
};

/** Eine leere Liste, für die Leerzustände der Verwaltung. */
export const EMPTY_LIST = { items: [], nextCursor: null };

/** Leere Texte, für den Leerzustand von `Texts`. */
export const EMPTY_TEXTS = { revision: 'e2e', locales: ['de', 'en'], entries: [] };

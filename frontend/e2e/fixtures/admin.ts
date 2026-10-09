/** The admin mocks for boards and flows. */

export const NOW = '2026-09-12T10:00:00+02:00';

/** The permissions that show each admin item. */
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

/** The counters of the `Admin` board. */
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
  groups: 2,
  groupMembers: 7,
  glossary: 24,
};

/** An empty admin count for the empty state. */
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

/** A role as `/api/roles` gives it. */
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

/** The four roles of the `Roles` board. */
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

/** The permission catalogue as `/api/permissions` gives it. */
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

/** An account as `/api/people` gives it. */
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

/** The four accounts of the `People` board. */
export const PEOPLE = {
  items: [
    person('frederik', 'Frederik', 'frederik@example.org', 'admin', 'Admin'),
    person('jonas', 'Jonas', 'jonas@example.org', 'advisor', 'Pilzberater'),
    person('testerin', 'Testerin', 'test@example.org', 'user', 'Nutzer'),
    person('marie', 'Marie', 'marie@example.org', 'translator', 'Übersetzer'),
  ],
  nextCursor: null,
};

/** The four species of the `AdminSpecies` board with their numbers. */
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

/** A UI text key as `/api/texts` gives it. */
export function text(key: string, de: string, en: string, changed = false): Record<string, unknown> {
  return { key, values: { de, en }, changed, updatedAt: NOW };
}

/** The four keys of the `Texts` board. */
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

/** An empty list for the admin empty states. */
export const EMPTY_LIST = { items: [], nextCursor: null };

/** Empty texts for the empty state of `Texts`. */
export const EMPTY_TEXTS = { revision: 'e2e', locales: ['de', 'en'], entries: [] };

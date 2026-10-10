/** The photo mocks for the boards and flows of the images page. */

interface Shape {
  id: string;
  speciesId: string;
  photographer: string;
  ownerName?: string;
  licence: string;
  source?: string | null;
  caption?: string | null;
  captionEn?: string;
  takenOn?: string | null;
  lat?: number | null;
  lon?: number | null;
  lead?: boolean;
  state?: string;
  createdAt?: string;
}

/** A photo in the contract shape. */
export function photo(entry: Shape): Record<string, unknown> {
  return {
    id: entry.id,
    ownerId: '00000000-0000-4000-a000-000000000001',
    speciesId: entry.speciesId,
    findId: null,
    width: 1600,
    height: 1200,
    photographer: entry.photographer,
    ownerName: entry.ownerName ?? entry.photographer.split(' ')[0],
    licence: entry.licence,
    caption: entry.caption ?? null,
    captionEn: entry.captionEn ?? '',
    source: entry.source ?? null,
    takenOn: entry.takenOn ?? '2026-09-06',
    lat: entry.lat ?? null,
    lon: entry.lon ?? null,
    lead: entry.lead ?? false,
    state: entry.state ?? 'approved',
    rejectReason: null,
    reviewedById: null,
    reviewedAt: null,
    createdAt: entry.createdAt ?? '2026-09-09T08:00:00+02:00',
    updatedAt: '2026-09-09T08:00:00+02:00',
  };
}

/** The photo in a species row: 44 x 44 px. */
export const ROW_PHOTO = { list: 'photo-44x44.png' };

/** The file name of a board photo mock: `photo-<width>x<height>.png`. */
export function photoFixture(width: number, height: number): string {
  return `photo-${String(width)}x${String(height)}.png`;
}

/** One page of photos without a cursor. */
export function photoPage(items: readonly Record<string, unknown>[]): Record<string, unknown> {
  return { items, nextCursor: null };
}

/** The species ID that `species()` gives for the same rank. */
export const STONE_ID = '00000000-0000-4000-8000-000000000000';
export const CHANTERELLE_ID = '00000000-0000-4000-8000-000000000001';

/** The species of the boards `SpeciesImages`, `ImageView`, `ImageAdd` and `ImageSubmit`. */
export const STONE_SPECIES = {
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  latin: 'Boletus edulis',
  edibility: 'edible',
} as const;

/** The species of the boards `ImageQueue`, `ImageReviewItem` and `ImageReject`. */
export const CHANTERELLE_SPECIES = {
  slug: 'cantharellus-cibarius',
  name: 'Pfifferling',
  latin: 'Cantharellus cibarius',
  edibility: 'edible',
} as const;

const PHOTOGRAPHER = 'Frederik Beimgraben';
const LICENCE = 'cc_by_sa_4';

/** Four approved images of the species. The first one is the lead image. */
export const SPECIES_PHOTOS = [
  photo({ id: 'bild-eins', speciesId: STONE_ID, photographer: PHOTOGRAPHER, licence: LICENCE, lead: true }),
  photo({
    id: 'bild-zwei',
    speciesId: STONE_ID,
    photographer: PHOTOGRAPHER,
    licence: LICENCE,
    lat: 48.51,
    lon: 9.06,
  }),
  photo({ id: 'bild-drei', speciesId: STONE_ID, photographer: PHOTOGRAPHER, licence: LICENCE }),
  photo({ id: 'bild-vier', speciesId: STONE_ID, photographer: PHOTOGRAPHER, licence: LICENCE }),
];

/** Four submissions in the review queue. The first one belongs to Jonas. */
export const QUEUE_PHOTOS = [
  photo({
    id: 'einreichung-eins',
    speciesId: CHANTERELLE_ID,
    photographer: 'Jonas Weber',
    licence: 'cc_by_4',
    caption: 'Junge Exemplare im Moos',
    lat: 48.51,
    lon: 9.06,
    state: 'submitted',
  }),
  photo({
    id: 'einreichung-zwei',
    speciesId: CHANTERELLE_ID,
    photographer: 'Marie Weber',
    licence: 'cc0',
    state: 'submitted',
  }),
  photo({
    id: 'einreichung-drei',
    speciesId: CHANTERELLE_ID,
    photographer: 'Marie Weber',
    licence: 'cc0',
    state: 'submitted',
  }),
  photo({
    id: 'einreichung-vier',
    speciesId: CHANTERELLE_ID,
    photographer: 'Marie Weber',
    licence: 'cc0',
    state: 'submitted',
  }),
];

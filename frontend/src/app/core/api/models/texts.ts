import type { components } from '../contract';

/**
 * A UI key with its languages. `changed` is true when one or more languages differ from the default.
 */
export type TextEntry = components['schemas']['TextEntry'];

/** `GET /api/texts`: the full catalogue, with its version as ETag. */
export type TextCatalogue = components['schemas']['TextsCatalogue'];

import type { components } from '../contract';

/**
 * Ein Schlüssel der Oberfläche mit seinen Sprachen. `changed` sagt, dass
 * mindestens eine Sprache von der Vorgabe abweicht.
 */
export type TextEntry = components['schemas']['TextEntry'];

/** `GET /api/texts`: der ganze Katalog, dazu seine Fassung als ETag. */
export type TextCatalogue = components['schemas']['TextsCatalogue'];

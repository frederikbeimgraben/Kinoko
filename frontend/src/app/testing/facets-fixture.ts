import type { FacetCatalogue } from '../core/api/models';

/**
 * Ein kleiner Merkmalskatalog: eine dichte Gruppe, eine lückenhafte, eine mit
 * Teilen und eine, die diese Oberfläche noch nicht wählen lässt.
 */
export const FACETS: FacetCatalogue = {
  arten: 306,
  gruppen: [
    {
      schluessel: 'speisewert',
      art: 'werte',
      beschrieben: 306,
      werte: [
        { wert: 'essbar', anzahl: 180 },
        { wert: 'giftig', anzahl: 54 },
        { wert: 'toedlichGiftig', anzahl: 21 },
      ],
      teile: [],
    },
    {
      schluessel: 'farbe',
      art: 'farben',
      beschrieben: 306,
      werte: [],
      teile: [
        {
          teil: 'cap',
          beschrieben: 303,
          werte: [{ wert: 'braun', anzahl: 120 }],
          einheit: null,
          von: null,
          bis: null,
        },
      ],
    },
    {
      schluessel: 'fruchtschicht',
      art: 'teile',
      beschrieben: 273,
      werte: [],
      teile: [
        {
          teil: 'art',
          beschrieben: 273,
          werte: [
            { wert: 'lamellen', anzahl: 177 },
            { wert: 'roehren', anzahl: 64 },
          ],
          einheit: null,
          von: null,
          bis: null,
        },
      ],
    },
    {
      schluessel: 'hutform',
      art: 'werte',
      beschrieben: 94,
      werte: [
        { wert: 'gewoelbt', anzahl: 15 },
        { wert: 'flach', anzahl: 27 },
        { wert: 'zylindrisch', anzahl: 0 },
      ],
      teile: [],
    },
  ],
};

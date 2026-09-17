/** Die Attrappen der Abschnitte des Arten-Editors. */

import { STONE_EDIT } from './species-editor';

/** Die Begriffe des Katalogs, wie `/api/terms` sie liefert. */
export const TERMS = {
  items: [
    { id: 't-1', kind: 'smell', group: null, slug: 'mushroomy', name: 'pilzig', position: 1 },
    { id: 't-2', kind: 'smell', group: null, slug: 'aniseed', name: 'anisartig', position: 2 },
    { id: 't-3', kind: 'smell', group: null, slug: 'mealy', name: 'mehlig', position: 3 },
    { id: 't-4', kind: 'smell', group: null, slug: 'radish', name: 'rettichartig', position: 4 },
    { id: 't-5', kind: 'smell', group: null, slug: 'nutty', name: 'nussig', position: 5 },
    { id: 't-6', kind: 'smell', group: null, slug: 'sweetish', name: 'süßlich', position: 6 },
    { id: 't-7', kind: 'smell', group: null, slug: 'pleasant', name: 'angenehm', position: 7 },
    { id: 't-8', kind: 'smell', group: null, slug: 'pungent', name: 'streng', position: 8 },
    { id: 't-9', kind: 'smell', group: null, slug: 'chemical', name: 'chemisch', position: 9 },
    { id: 't-10', kind: 'smell', group: null, slug: 'fruity', name: 'obstartig', position: 10 },
    { id: 't-11', kind: 'smell', group: null, slug: 'earthy', name: 'erdig', position: 11 },
  ],
};

/** Die Art der Abschnitte: Maße, Zeitraum, Fruchtschicht und Geruch. */
export const STONE_SECTIONS: Record<string, unknown> = {
  ...STONE_EDIT,
  periodStartMonth: 6,
  periodEndMonth: 10,
  periodPeakMonth: null,
  hymeniumType: 'gills',
  gillAttachment: 'free',
  gillSpacing: 'close',
  gillEdge: 'smooth',
  smellText: 'Frisch angenehm pilzig, mit dem Alter etwas streng.',
  terms: [
    { term: { id: 't-1', slug: 'mushroomy', name: 'pilzig', kind: 'smell' }, fromExperience: false },
    { term: { id: 't-5', slug: 'nutty', name: 'nussig', kind: 'smell' }, fromExperience: false },
    { term: { id: 't-7', slug: 'pleasant', name: 'angenehm', kind: 'smell' }, fromExperience: false },
  ],
  colours: [
    {
      part: 'cap',
      mode: 'gradient',
      colours: [
        { name: 'hellbraun', hex: '#b08a5a' },
        { name: 'dunkelbraun', hex: '#5a3d22' },
      ],
    },
    {
      part: 'gills',
      mode: 'gradient',
      colours: [
        { name: 'rosa', hex: '#e8c8cf' },
        { name: 'dunkelbraun', hex: '#4a3220' },
      ],
    },
  ],
};

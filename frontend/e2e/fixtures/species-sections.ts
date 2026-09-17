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
    { id: 'a-1', kind: 'trigger', group: 'mechanical', slug: 'pressure', name: 'Druck', position: 1 },
    { id: 'a-2', kind: 'trigger', group: 'mechanical', slug: 'cut', name: 'Anschnitt', position: 2 },
    { id: 'a-3', kind: 'trigger', group: 'mechanical', slug: 'injury', name: 'Verletzung', position: 3 },
  ],
};

/** Die Standardfarben des Bretts `EditColour`. */
export const PALETTE = [
  '#f4efe2',
  '#f0ece0',
  '#e2c79a',
  '#c9a877',
  '#d9a441',
  '#e0a33c',
  '#b8792f',
  '#8a4e2b',
  '#6b4423',
  '#4a3220',
  '#cfd08a',
  '#9db44f',
  '#5f7f42',
  '#7f8f6a',
  '#c94f3d',
  '#a8342c',
  '#d2685f',
  '#8a3f6b',
  '#5b7fb0',
  '#3f6ea8',
  '#2f3a4a',
  '#1b1d1c',
].map((hex, at) => ({ key: `ton-${String(at)}`, hex }));

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
  colourChanges: [
    {
      part: 'cap',
      kind: 'mechanical',
      from: { name: 'weiß', hex: '#f4efe2' },
      to: { name: 'blau', hex: '#5b7fb0' },
      speed: '1min',
      triggers: [
        { id: 'a-1', slug: 'pressure', name: 'Druck', kind: 'trigger' },
        { id: 'a-2', slug: 'cut', name: 'Anschnitt', kind: 'trigger' },
      ],
    },
  ],
  colours: [
    {
      part: 'cap',
      mode: 'gradient',
      colours: [
        { name: 'violett', hex: '#7a3b6a' },
        { name: 'grün', hex: '#4f7a3a' },
        { name: 'oliv', hex: '#7f8a3a' },
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

/** Die Art des Bretts `EditPart`: ein Maß, eine Farbe, eine Verfärbung. */
export const PART_SECTIONS: Record<string, unknown> = {
  ...STONE_SECTIONS,
  colours: [
    {
      part: 'cap',
      mode: 'gradient',
      colours: [
        { name: 'hellbraun', hex: '#e2c79a' },
        { name: 'dunkelbraun', hex: '#6b4423' },
      ],
    },
  ],
  colourChanges: [
    {
      part: 'cap',
      kind: 'mechanical',
      from: { name: 'weiß', hex: '#f4efe2' },
      to: { name: 'blau', hex: '#5b7fb0' },
      speed: '1min',
      triggers: [{ id: 'a-4', slug: 'cut-surface', name: 'Schnitt', kind: 'trigger' }],
    },
  ],
};

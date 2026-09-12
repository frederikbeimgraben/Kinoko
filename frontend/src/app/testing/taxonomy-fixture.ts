import type { Taxon } from '../core/api/models';
import { PENNY_BUN_BRIEF } from './species-fixture';

/**
 * Die Gattung Boletus: darüber Familie, Ordnung und Klasse, daneben eine zweite
 * Gattung, darunter keine Stufe mehr, aber eine Art.
 */
export const BOLETUS: Taxon = {
  rang: 'gattung',
  rangfolge: 4,
  slug: 'boletus',
  name: 'Boletus',
  lateinisch: 'Boletus',
  beschreibung: null,
  pfad: [
    {
      rang: 'abteilung',
      rangfolge: 0,
      slug: 'basidiomycota',
      name: 'Basidiomycota',
      lateinisch: 'Basidiomycota',
    },
    {
      rang: 'klasse',
      rangfolge: 1,
      slug: 'agaricomycetes',
      name: 'Agaricomycetes',
      lateinisch: 'Agaricomycetes',
    },
    { rang: 'ordnung', rangfolge: 2, slug: 'boletales', name: 'Röhrlinge', lateinisch: 'Boletales' },
    { rang: 'familie', rangfolge: 3, slug: 'boletaceae', name: 'Boletaceae', lateinisch: 'Boletaceae' },
  ],
  geschwister: [{ rang: 'gattung', rangfolge: 4, slug: 'imleria', name: 'Imleria', lateinisch: 'Imleria' }],
  kinder: [],
  arten: [PENNY_BUN_BRIEF],
  artenZahl: 1,
};

/** Die Familie darüber: Gattungen als Kinder, keine Art unmittelbar an ihr. */
export const BOLETACEAE: Taxon = {
  rang: 'familie',
  rangfolge: 3,
  slug: 'boletaceae',
  name: 'Boletaceae',
  lateinisch: 'Boletaceae',
  beschreibung: null,
  pfad: [
    {
      rang: 'abteilung',
      rangfolge: 0,
      slug: 'basidiomycota',
      name: 'Basidiomycota',
      lateinisch: 'Basidiomycota',
    },
    {
      rang: 'klasse',
      rangfolge: 1,
      slug: 'agaricomycetes',
      name: 'Agaricomycetes',
      lateinisch: 'Agaricomycetes',
    },
    { rang: 'ordnung', rangfolge: 2, slug: 'boletales', name: 'Röhrlinge', lateinisch: 'Boletales' },
  ],
  geschwister: [
    { rang: 'familie', rangfolge: 3, slug: 'suillaceae', name: 'Suillaceae', lateinisch: 'Suillaceae' },
  ],
  kinder: [
    { rang: 'gattung', rangfolge: 4, slug: 'boletus', name: 'Boletus', lateinisch: 'Boletus', artenZahl: 1 },
    { rang: 'gattung', rangfolge: 4, slug: 'imleria', name: 'Imleria', lateinisch: 'Imleria', artenZahl: 0 },
  ],
  arten: [],
  artenZahl: 1,
};

/** Die Wurzel: kein Pfad, kein Nachbar. */
export const BASIDIOMYCOTA: Taxon = {
  rang: 'abteilung',
  rangfolge: 0,
  slug: 'basidiomycota',
  name: 'Basidiomycota',
  lateinisch: 'Basidiomycota',
  beschreibung: null,
  pfad: [],
  geschwister: [],
  kinder: [
    {
      rang: 'klasse',
      rangfolge: 1,
      slug: 'agaricomycetes',
      name: 'Agaricomycetes',
      lateinisch: 'Agaricomycetes',
      artenZahl: 1,
    },
  ],
  arten: [],
  artenZahl: 1,
};

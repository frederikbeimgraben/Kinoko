import type { ColourChange } from '../../../core/api/models';
import type { I18nService } from '../../../core/i18n/i18n.service';
import type { TranslationKey } from '../../../core/i18n/translations';
import { PART_TEXT } from '../labels';
import type { SpeciesReaction } from '../species.store';

/** How the swatch of a row shows the result: a fill, a hatch, a ring or nothing. */
export type SwatchKind = 'fill' | 'range' | 'hatch' | 'ring' | 'none';

/** The swatch of a row. `colours` are hex values: one for a fill or a hatch, two for a range. */
export interface RowSwatch {
  readonly kind: SwatchKind;
  readonly colours: readonly string[];
  /** The name of the swatch for a screen reader. */
  readonly label: string;
}

/** One row of the section "Verfärbung". */
export interface ChangeRow {
  readonly key: string;
  readonly label: string;
  readonly sub: string;
  /** The plain value at the end of the row, for example the part and the location. */
  readonly plain: string;
  readonly swatch: RowSwatch;
  readonly contested: boolean;
  readonly partlyConfirmed: boolean;
}

/** One source of the reactions. */
export interface ReactionSourceRow {
  readonly label: string;
  readonly sub: string;
  readonly url: string | null;
}

const RESULT_TEXT: Readonly<Record<SpeciesReaction['result'], TranslationKey>> = {
  positive: 'species.reaction.positive',
  negative: 'species.reaction.negative',
  variable: 'species.reaction.variable',
  unknown: 'species.reaction.unknown',
};

/** The mark after the reagent name of a partly confirmed reaction. */
export const DAGGER = '†';

const SEPARATOR = ', ';

const NO_SWATCH: Omit<RowSwatch, 'label'> = { kind: 'none', colours: [] };

/** The CSS background of a swatch. A ring has no fill: its border shows it. */
export function swatchBackground(swatch: RowSwatch): string | null {
  const [first, second] = swatch.colours;
  switch (swatch.kind) {
    case 'fill':
      return first ?? null;
    case 'range':
      return `linear-gradient(135deg, ${first}, ${second ?? first})`;
    case 'hatch':
      return `repeating-linear-gradient(135deg, ${first} 0 6px, var(--surface-high) 6px 10px)`;
    case 'ring':
    case 'none':
      return null;
  }
}

/** The swatch of a reaction: a fill for a positive colour, a hatch for a variable one, a ring for negative. */
export function reactionSwatch(reaction: SpeciesReaction, i18n: I18nService): RowSwatch {
  const result = i18n.translate(RESULT_TEXT[reaction.result]);
  const label = reaction.colour === null ? result : `${result}, ${reaction.colour.name}`;
  if (reaction.result === 'negative') return { kind: 'ring', colours: [], label };
  if (reaction.colour === null) return { ...NO_SWATCH, label };
  if (reaction.result === 'positive') return { kind: 'fill', colours: [reaction.colour.hex], label };
  if (reaction.result === 'variable') return { kind: 'hatch', colours: [reaction.colour.hex], label };
  return { ...NO_SWATCH, label };
}

/** A row of a reaction: the reagent as label, the reading below, the part and location at the end. */
export function reactionRow(reaction: SpeciesReaction, index: number, i18n: I18nService): ChangeRow {
  const place = [reaction.part === null ? '' : i18n.translate(PART_TEXT[reaction.part]), reaction.location ?? '']
    .filter((one) => one.trim() !== '')
    .join(SEPARATOR);
  const unknown = reaction.result === 'unknown' && place === '';
  return {
    key: `reaction-${index}-${reaction.reagent.slug}`,
    label: reaction.partlyConfirmed ? `${reaction.reagent.name} ${DAGGER}` : reaction.reagent.name,
    sub: reaction.reading,
    plain: unknown ? i18n.translate('species.reaction.unknown') : place,
    swatch: reactionSwatch(reaction, i18n),
    contested: reaction.contested,
    partlyConfirmed: reaction.partlyConfirmed,
  };
}

/** A row of a colour change: the triggers as label, "part from to" below, the colours as a swatch. */
export function colourChangeRow(change: ColourChange, index: number, i18n: I18nService): ChangeRow {
  const part = i18n.translate(PART_TEXT[change.part]);
  const sub = change.from
    ? i18n.translate('species.colourChange.change', { part, from: change.from.name, to: change.to.name })
    : i18n.translate('species.colourChange.changeTo', { part, to: change.to.name });
  const colours = change.from ? [change.from.hex, change.to.hex] : [change.to.hex];
  return {
    key: `change-${index}`,
    label: change.triggers.map((term) => term.name).join(SEPARATOR),
    sub,
    plain: '',
    swatch: { kind: colours.length > 1 ? 'range' : 'fill', colours, label: sub },
    contested: false,
    partlyConfirmed: false,
  };
}

/** The sources of all reactions, each one time, in the order of the reactions. */
export function reactionSources(reactions: readonly SpeciesReaction[]): ReactionSourceRow[] {
  const all = reactions.flatMap((reaction) => reaction.sources);
  const keyOf = (source: (typeof all)[number]): string => `${source.label}|${source.url ?? ''}|${source.year ?? ''}`;
  return all
    .filter((source, index) => all.findIndex((other) => keyOf(other) === keyOf(source)) === index)
    .map((source) => ({
      label: source.label,
      sub: [hostOf(source.url), source.year ?? ''].filter((one) => one !== '').join(' · '),
      url: source.url,
    }));
}

/** The host name of an address, without `www.`. An address that does not parse gives an empty text. */
export function hostOf(url: string | null): string {
  if (url === null) return '';
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

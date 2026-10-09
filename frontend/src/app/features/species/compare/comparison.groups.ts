import type { I18nService } from '../../../core/i18n/i18n.service';
import type { SpeciesEntry } from '../../../core/api/models';
import type { TranslationKey } from '../../../core/i18n/translations';
import type { CatalogueNames } from '../catalogue-text';
import { EDIBILITY_TEXT, EDIBILITY_TONE, MUTED_TONE } from '../labels';
import { badgeCell, buildRow, plainCell, swatchCell, valueCell, type Group } from './comparison.cells';
import {
  capShapeOf,
  hymeniumColourOf,
  hymeniumTypeOf,
  measurementOf,
  partNoteOf,
  ringShapeOf,
  seasonOf,
  senseSmellOf,
  stemFeatureOf,
  reagentRows,
  swatchOf,
  type ReactionsOf,
} from './comparison.rows';

export type { ReactionsOf } from './comparison.rows';

/** The table has two narrow columns: the protection takes the short words of `CompareTable.dc.html`. */
const PROTECTION_SHORT: Readonly<Record<SpeciesEntry['protection'], TranslationKey>> = {
  none: 'species.compare.protection.none',
  personal_use: 'species.compare.protection.personalUse',
  strict: 'species.compare.protection.strict',
};

/** The groups of the table, in the order of the body. */
function rawGroups(
  entries: readonly SpeciesEntry[],
  i18n: I18nService,
  names: CatalogueNames,
  reactionsOf: ReactionsOf,
): readonly Group[] {
  return [
    {
      label: i18n.translate('species.section.classification'),
      rows: [
        buildRow(i18n.translate('species.field.edibility'), entries, (entry) =>
          badgeCell(
            i18n.translate(EDIBILITY_TEXT[entry.edibility]),
            EDIBILITY_TONE[entry.edibility].colour,
            EDIBILITY_TONE[entry.edibility].background,
          ),
        ),
        buildRow(i18n.translate('species.field.protection'), entries, (entry) =>
          badgeCell(
            i18n.translate(PROTECTION_SHORT[entry.protection]),
            MUTED_TONE.colour,
            MUTED_TONE.background,
          ),
        ),
      ],
    },
    {
      label: i18n.translate('species.field.cap'),
      rows: [
        buildRow(i18n.translate('enum.dimension.width'), entries, (entry) =>
          valueCell(measurementOf(entry, 'cap', 'width', i18n)),
        ),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) =>
          swatchCell(swatchOf(entry, 'cap', names)),
        ),
        buildRow(i18n.translate('species.field.shape'), entries, (entry) =>
          plainCell(capShapeOf(entry, i18n)),
        ),
      ],
    },
    {
      label: i18n.translate('species.field.stem'),
      rows: [
        buildRow(i18n.translate('enum.dimension.height'), entries, (entry) =>
          valueCell(measurementOf(entry, 'stem', 'length', i18n)),
        ),
        buildRow(i18n.translate('enum.dimension.thickness'), entries, (entry) =>
          valueCell(measurementOf(entry, 'stem', 'thickness', i18n)),
        ),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) =>
          swatchCell(swatchOf(entry, 'stem', names)),
        ),
        buildRow(i18n.translate('species.field.net'), entries, (entry) =>
          plainCell(stemFeatureOf(entry, ['netted'], i18n)),
        ),
      ],
    },
    {
      label: i18n.translate('species.field.ring'),
      rows: [
        buildRow(i18n.translate('species.compare.present'), entries, (entry) =>
          plainCell(stemFeatureOf(entry, ['ring'], i18n)),
        ),
        buildRow(i18n.translate('species.field.shape'), entries, (entry) =>
          plainCell(ringShapeOf(entry, i18n)),
        ),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) =>
          swatchCell(swatchOf(entry, 'ring', names)),
        ),
      ],
    },
    {
      label: i18n.translate('species.field.bulb'),
      rows: [
        buildRow(i18n.translate('species.compare.present'), entries, (entry) =>
          plainCell(stemFeatureOf(entry, ['bulb'], i18n)),
        ),
        buildRow(i18n.translate('species.field.volva'), entries, (entry) =>
          plainCell(stemFeatureOf(entry, ['volva'], i18n)),
        ),
        buildRow(i18n.translate('species.field.shape'), entries, (entry) =>
          plainCell(partNoteOf(entry, 'stem_base')),
        ),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) =>
          swatchCell(swatchOf(entry, 'stem_base', names)),
        ),
      ],
    },
    {
      label: i18n.translate('species.section.hymenium'),
      rows: [
        buildRow(i18n.translate('species.hymeniumType'), entries, (entry) =>
          plainCell(hymeniumTypeOf(entry, i18n)),
        ),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) =>
          swatchCell(hymeniumColourOf(entry, names)),
        ),
      ],
    },
    {
      label: i18n.translate('species.field.flesh'),
      rows: [
        buildRow(i18n.translate('species.section.colour'), entries, (entry) =>
          swatchCell(swatchOf(entry, 'flesh', names)),
        ),
        buildRow(i18n.translate('species.field.smell'), entries, (entry) =>
          plainCell(senseSmellOf(entry, names)),
        ),
      ],
    },
    {
      label: i18n.translate('species.section.colourChange'),
      rows: reagentRows(entries, reactionsOf, i18n, names),
    },
    {
      label: i18n.translate('species.field.spore'),
      rows: [
        buildRow(i18n.translate('enum.dimension.length'), entries, (entry) =>
          valueCell(measurementOf(entry, 'spore', 'length', i18n)),
        ),
        buildRow(i18n.translate('species.field.powder'), entries, (entry) =>
          swatchCell(swatchOf(entry, 'spore_print', names)),
        ),
      ],
    },
    {
      label: i18n.translate('species.field.time'),
      rows: [
        buildRow(i18n.translate('species.section.season'), entries, (entry) =>
          plainCell(seasonOf(entry, i18n)),
        ),
      ],
    },
  ];
}

/** The groups of the table without empty rows and empty groups. */
export function compareGroups(
  entries: readonly SpeciesEntry[],
  i18n: I18nService,
  names: CatalogueNames,
  diffOnly: boolean,
  reactionsOf: ReactionsOf = () => [],
): readonly Group[] {
  return rawGroups(entries, i18n, names, reactionsOf)
    .map((group) => ({
      label: group.label,
      rows: group.rows.filter(
        (row) => row.cells.some((cell) => cell.kind !== 'none') && (!diffOnly || row.diff),
      ),
    }))
    .filter((group) => group.rows.length > 0);
}

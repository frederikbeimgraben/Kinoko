import type { I18nService } from '../../../core/i18n/i18n.service';
import type { SpeciesEntry } from '../../../core/api/models';
import { EDIBILITY_TEXT, EDIBILITY_TONE, MUTED_TONE, PROTECTION_TEXT } from '../labels';
import { badgeCell, buildRow, plainCell, swatchCell, valueCell, type Group } from './comparison.cells';
import {
  capShapeOf,
  changeRows,
  hymeniumColourOf,
  hymeniumTypeOf,
  measurementOf,
  partNoteOf,
  seasonOf,
  senseSmellOf,
  swatchOf,
} from './comparison.rows';

/** Die Gruppen des Bretts, in der Folge des Körpers. */
function rawGroups(entries: readonly SpeciesEntry[], i18n: I18nService): readonly Group[] {
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
            i18n.translate(PROTECTION_TEXT[entry.protection]),
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
          swatchCell(swatchOf(entry, 'cap')),
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
          swatchCell(swatchOf(entry, 'stem')),
        ),
        buildRow(i18n.translate('species.field.net'), entries, (entry) =>
          plainCell(partNoteOf(entry, 'stem')),
        ),
      ],
    },
    {
      label: i18n.translate('species.field.ring'),
      rows: [
        buildRow(i18n.translate('species.field.shape'), entries, (entry) =>
          plainCell(partNoteOf(entry, 'ring')),
        ),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) =>
          swatchCell(swatchOf(entry, 'ring')),
        ),
      ],
    },
    {
      label: i18n.translate('species.field.bulb'),
      rows: [
        buildRow(i18n.translate('species.field.shape'), entries, (entry) =>
          plainCell(partNoteOf(entry, 'stem_base')),
        ),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) =>
          swatchCell(swatchOf(entry, 'stem_base')),
        ),
      ],
    },
    {
      label: i18n.translate('species.section.hymenium'),
      rows: [
        buildRow(i18n.translate('species.fieldLabel'), entries, (entry) =>
          plainCell(hymeniumTypeOf(entry, i18n)),
        ),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) =>
          swatchCell(hymeniumColourOf(entry)),
        ),
      ],
    },
    {
      label: i18n.translate('species.field.flesh'),
      rows: [
        buildRow(i18n.translate('species.section.colour'), entries, (entry) =>
          swatchCell(swatchOf(entry, 'flesh')),
        ),
        buildRow(i18n.translate('species.field.smell'), entries, (entry) => plainCell(senseSmellOf(entry))),
      ],
    },
    { label: i18n.translate('species.section.colourChange'), rows: changeRows(entries, i18n) },
    {
      label: i18n.translate('species.field.spore'),
      rows: [
        buildRow(i18n.translate('enum.dimension.length'), entries, (entry) =>
          valueCell(measurementOf(entry, 'spore', 'length', i18n)),
        ),
        buildRow(i18n.translate('species.field.powder'), entries, (entry) =>
          swatchCell(swatchOf(entry, 'spore_print')),
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

/** Die Gruppen des Bretts: leere Zeilen und leere Gruppen fallen weg. */
export function compareGroups(
  entries: readonly SpeciesEntry[],
  i18n: I18nService,
  diffOnly: boolean,
): readonly Group[] {
  return rawGroups(entries, i18n)
    .map((group) => ({
      label: group.label,
      rows: group.rows.filter(
        (row) => row.cells.some((cell) => cell.kind !== 'none') && (!diffOnly || row.diff),
      ),
    }))
    .filter((group) => group.rows.length > 0);
}

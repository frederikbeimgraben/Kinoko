import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import type { WorkshopKey } from '../../../../core/i18n/workshop-texts';
import { AccountTileComponent } from '../../../../ui/account-tile/account-tile.component';
import { EntryListComponent, type EntryListRow } from '../../../../ui/entry-list/entry-list.component';
import { EntryRowComponent, type EntryRowEntry } from '../../../../ui/entry-row/entry-row.component';
import { ExpandRowComponent } from '../../../../ui/expand-row/expand-row.component';
import { FilterChipComponent } from '../../../../ui/filter-chip/filter-chip.component';
import { ChipGroupComponent, type Chip } from '../../../../ui/chip-group/chip-group.component';
import { FoldSectionComponent } from '../../../../ui/fold-section/fold-section.component';
import { ListRowComponent } from '../../../../ui/list-row/list-row.component';
import { BlockCardComponent } from '../block-card/block-card.component';

/** One find of the sample list: day, title, meta, note, colour, pending. */
type SampleFind = readonly [WorkshopKey, WorkshopKey, WorkshopKey, WorkshopKey | null, string, boolean];

/** The five finds of `EntryList.dc.html`, `type` `finds`. */
const FINDS: readonly SampleFind[] = [
  [
    'beispiel.tagHeute',
    'beispiel.pfifferling',
    'beispiel.metaPfifferling',
    'beispiel.notizHang',
    '#b9832a',
    true,
  ],
  [
    'beispiel.tagSeptember',
    'beispiel.steinpilz',
    'beispiel.metaSteinpilz',
    'beispiel.notizFichten',
    '#7a5230',
    false,
  ],
  [
    'beispiel.tagSeptember',
    'beispiel.steinpilz',
    'beispiel.metaTesterin',
    'beispiel.notizWegrand',
    '#7a5230',
    false,
  ],
  [
    'beispiel.tagSeptember',
    'beispiel.parasol',
    'beispiel.metaParasol',
    'beispiel.notizWiese',
    '#a08a6a',
    false,
  ],
  ['beispiel.tagSeptember', 'beispiel.flaschenbovist', 'beispiel.metaBovist', null, '#c9c2ad', false],
];

/** The four values of `ChipSet.dc.html`, its default `names`. */
const EDIBILITY: readonly (readonly [string, WorkshopKey])[] = [
  ['edible', 'beispiel.essbar'],
  ['inedible', 'beispiel.ungeniessbar'],
  ['poisonous', 'beispiel.giftig'],
  ['deadly', 'beispiel.toedlich'],
];

/** The eight rows of the D1 rows batch, each its board default. */
@Component({
  selector: 'app-rows-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccountTileComponent,
    BlockCardComponent,
    ChipGroupComponent,
    EntryListComponent,
    EntryRowComponent,
    ExpandRowComponent,
    FilterChipComponent,
    FoldSectionComponent,
    ListRowComponent,
    TranslatePipe,
  ],
  templateUrl: './rows-cards.component.html',
  styleUrl: './rows-cards.component.scss',
})
export class RowsCardsComponent {
  private readonly i18n = inject(I18nService);

  protected readonly entryListRows: readonly EntryListRow[] = FINDS.map(
    ([day, title, meta, note, colour, pending], index) => ({
      key: `${title}-${index}`,
      day: this.i18n.translate(day),
      entry: {
        title: this.i18n.translate(title),
        meta: this.i18n.translate(meta),
        ...(note === null ? {} : { note: this.i18n.translate(note) }),
        colour,
      },
      pending,
    }),
  );
  protected readonly entry: EntryRowEntry = this.entryListRows[1].entry;
  protected readonly edibilityChips: readonly Chip[] = EDIBILITY.map(([value, label]) => ({
    value,
    label: this.i18n.translate(label),
  }));
}

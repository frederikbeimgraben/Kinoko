import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { AccountTileComponent } from '../../../../ui/account-tile/account-tile.component';
import { EntryListComponent, type EntryListRow } from '../../../../ui/entry-list/entry-list.component';
import { EntryRowComponent, type EntryRowEntry } from '../../../../ui/entry-row/entry-row.component';
import { ExpandRowComponent } from '../../../../ui/expand-row/expand-row.component';
import { FilterChipComponent } from '../../../../ui/filter-chip/filter-chip.component';
import { ChipGroupComponent, type Chip } from '../../../../ui/chip-group/chip-group.component';
import { FoldSectionComponent } from '../../../../ui/fold-section/fold-section.component';
import { ListRowComponent } from '../../../../ui/list-row/list-row.component';
import { BlockCardComponent } from '../block-card/block-card.component';

/** The entry row of `EntryRow.dc.html`, its default props. */
const ENTRY: EntryRowEntry = {
  title: 'Boletus edulis',
  meta: 'Sept 6 · 3 pieces · Frederik',
  note: 'under fir trees',
  colour: '#7a5230',
};

/** The five days of `EntryList.dc.html`, `type` `finds`. */
const ENTRY_LIST_ROWS: readonly EntryListRow[] = [
  {
    key: 'chanterelle',
    day: 'Today',
    entry: {
      title: 'Cantharellus cibarius',
      meta: '2 pieces · Frederik',
      note: 'under fir trees on the slope',
      colour: '#b9832a',
    },
    pending: true,
  },
  {
    key: 'boletus-1',
    day: 'September',
    entry: {
      title: 'Boletus edulis',
      meta: 'Sept 6 · 3 pieces · Frederik',
      note: 'under fir trees',
      colour: '#7a5230',
    },
  },
  {
    key: 'boletus-2',
    day: 'September',
    entry: {
      title: 'Boletus edulis',
      meta: 'Sept 6 · Tester',
      note: 'trailside, mixed forest',
      colour: '#7a5230',
    },
  },
  {
    key: 'parasol',
    day: 'September',
    entry: {
      title: 'Macrolepiota procera',
      meta: 'Sept 4 · 5 pieces · Jonas',
      note: 'meadow at the forest edge, many young ones',
      colour: '#a08a6a',
    },
  },
  {
    key: 'puffball',
    day: 'September',
    entry: { title: 'Lycoperdon perlatum', meta: 'Sept 1 · Jonas', colour: '#c9c2ad' },
  },
];

/** The four values of `ChipSet.dc.html`, its default `names`. */
const EDIBILITY_CHIPS: readonly Chip[] = [
  { value: 'edible', label: 'edible' },
  { value: 'inedible', label: 'not edible' },
  { value: 'poisonous', label: 'poisonous' },
  { value: 'deadly', label: 'deadly poisonous' },
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
  protected readonly entry = ENTRY;
  protected readonly entryListRows = ENTRY_LIST_ROWS;
  protected readonly edibilityChips = EDIBILITY_CHIPS;
}

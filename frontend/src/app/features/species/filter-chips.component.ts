import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ChipRowComponent, type ChipRowItem } from '../../ui/chip-row/chip-row.component';
import type { IconName } from '../../ui/svg-icon/svg-icon.component';
import { isActive, type GroupKey } from './facets';
import { groupSummary, termNamesOf } from './filter-groups';
import { SpeciesFilterStore } from './filter.store';
import { GROUP_TEXT } from './labels';
import { SpeciesStore } from './species.store';

/** A group of the filter with its icon, in the order of the board. `all` is the whole sheet. */
export type ChipKey = 'all' | GroupKey;

const GROUPS: readonly { key: ChipKey; icon: IconName }[] = [
  { key: 'all', icon: 'filter' },
  { key: 'edibility', icon: 'eat' },
  { key: 'capShape', icon: 'mushroom' },
  { key: 'colour', icon: 'palette' },
];

/** The groups that show their value on their chip, in order of priority. */
const VALUE_GROUPS: readonly GroupKey[] = ['edibility', 'capShape', 'colour'];

/** The filter groups as chips above the species list. A chip opens the filter sheet. */
@Component({
  selector: 'app-species-filter-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipRowComponent],
  templateUrl: './filter-chips.component.html',
  host: { style: 'display: block; min-inline-size: 0' },
})
export class SpeciesFilterChipsComponent {
  private readonly catalogue = inject(SpeciesStore);
  private readonly filter = inject(SpeciesFilterStore);
  private readonly i18n = inject(I18nService);

  /** The group whose chip the person pressed. */
  readonly groupOpened = output<ChipKey>();

  /** The one group with a choice whose chip shows the value. Without a choice none. */
  private readonly active = computed<GroupKey | null>(() => {
    const selection = this.filter.selection();
    const names = termNamesOf(this.catalogue.entries());
    return VALUE_GROUPS.find((key) => groupSummary(key, selection, this.i18n, names) !== '') ?? null;
  });

  protected readonly chips = computed<ChipRowItem[]>(() => {
    const active = this.active();
    const selection = this.filter.selection();
    const names = termNamesOf(this.catalogue.entries());
    return GROUPS.map(({ key, icon }) => {
      if (key === 'all') {
        return {
          key,
          icon,
          label: '',
          on: active === null && isActive(selection),
          iconLabel: this.i18n.translate('common.filter'),
        };
      }
      const label = this.i18n.translate(GROUP_TEXT[key]);
      if (key !== active) return { key, icon, label };
      return { key, icon, label: `${label} · ${groupSummary(key, selection, this.i18n, names)}`, on: true };
    });
  });

  protected open(key: string): void {
    this.filter.openSheet();
    this.groupOpened.emit(key as ChipKey);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { FriendGroup, Visibility, Zone } from '../../core/api/models';
import { VISIBILITIES } from '../../core/api/models';
import { asDate } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import { FoldSectionComponent } from '../../ui/fold-section/fold-section.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SwitchComponent } from '../../ui/switch/switch.component';
import { visibilityText } from '../add-entry/visibility';
import { TIME_SPANS, type EntriesFilter, type TimeSpan } from './entry-filter';

/** The chips of one single choice: the chosen value, or none. */
function single(value: string | null): readonly string[] {
  return value === null ? [] : [value];
}

/** The body of the entries filter, per `EntriesFilterBody.dc.html`. */
@Component({
  selector: 'app-entries-filter-body',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipGroupComponent, FoldSectionComponent, ListRowComponent, RowGroupComponent, SwitchComponent, TranslatePipe],
  templateUrl: './entries-filter-body.component.html',
  styleUrl: './entries-filter-body.component.scss',
})
export class EntriesFilterBodyComponent {
  private readonly i18n = inject(I18nService);

  readonly filter = input.required<EntriesFilter>();
  readonly groups = input<readonly FriendGroup[]>([]);
  readonly zones = input<readonly Zone[]>([]);
  /** The day of the filter as an ISO date. It names the month and the year chip. */
  readonly today = input.required<string>();

  readonly filterChange = output<EntriesFilter>();

  protected readonly visibilityChips = computed<readonly Chip[]>(() =>
    VISIBILITIES.map((value) => ({ value, label: visibilityText(this.i18n, value) })),
  );

  protected readonly groupChips = computed<readonly Chip[]>(() =>
    this.groups().map((group) => ({ value: group.id, label: group.name })),
  );

  protected readonly zoneChips = computed<readonly Chip[]>(() =>
    this.zones().map((zone) => ({ value: zone.id, label: zone.name })),
  );

  protected readonly timeChips = computed<readonly Chip[]>(() => {
    const day = asDate(this.today());
    const labels: Readonly<Record<TimeSpan, string>> = {
      today: this.i18n.translate('common.today'),
      week: this.i18n.translate('entry.filter.thisWeek'),
      month: this.i18n.translate(`enum.month.${day.getMonth() + 1}` as 'enum.month.1'),
      year: String(day.getFullYear()),
    };
    return TIME_SPANS.map((value) => ({ value, label: labels[value] }));
  });

  protected readonly visibility = computed(() => single(this.filter().visibility));
  protected readonly group = computed(() => single(this.filter().groupId));
  protected readonly zone = computed(() => single(this.filter().zoneId));
  protected readonly time = computed(() => single(this.filter().time));

  protected setVisibility(values: readonly string[]): void {
    const visibility = VISIBILITIES.find((value) => value === values[0]) ?? null;
    this.change({ visibility: visibility satisfies Visibility | null });
  }

  protected setGroup(values: readonly string[]): void {
    this.change({ groupId: values[0] ?? null });
  }

  protected setZone(values: readonly string[]): void {
    this.change({ zoneId: values[0] ?? null });
  }

  protected setTime(values: readonly string[]): void {
    this.change({ time: TIME_SPANS.find((value) => value === values[0]) ?? null });
  }

  protected setPhoto(withPhoto: boolean): void {
    this.change({ withPhoto });
  }

  private change(part: Partial<EntriesFilter>): void {
    this.filterChange.emit({ ...this.filter(), ...part });
  }
}

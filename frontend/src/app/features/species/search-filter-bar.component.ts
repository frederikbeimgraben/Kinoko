import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FilterChipComponent } from '../../ui/filter-chip/filter-chip.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import type { IconName } from '../../ui/svg-icon/svg-icon.component';
import { isActive, type GroupKey } from './facets';
import { groupSummary, termNamesOf } from './filter-groups';
import { GROUP_TEXT } from './labels';
import { SpeciesFilterState } from './filter.state';
import { SpeciesState } from './species.state';

/** Eine Gruppe der Wahl, mit ihrem Zeichen. Die Reihenfolge des Bretts. */
type ChipKey = 'all' | GroupKey;

const GROUPS: readonly { key: ChipKey; icon: IconName }[] = [
  { key: 'all', icon: 'filter' },
  { key: 'edibility', icon: 'eat' },
  { key: 'capShape', icon: 'mushroom' },
  { key: 'colour', icon: 'palette' },
  { key: 'size', icon: 'ruler' },
];

/** Die Gruppen, die sich als Wert auf ihrem Zeichen zeigen, in Vorrang. */
const VALUE_GROUPS: readonly GroupKey[] = ['edibility', 'capShape', 'colour', 'size'];

/** Suchfeld und die Filtergruppen als Zeichen, per `kit.css` `.chiprow`. */
@Component({
  selector: 'app-species-search-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterChipComponent, SearchFieldComponent, TranslatePipe],
  templateUrl: './search-filter-bar.component.html',
  styleUrl: './search-filter-bar.component.scss',
})
export class SpeciesSearchFilterBarComponent {
  protected readonly state = inject(SpeciesState);
  protected readonly filter = inject(SpeciesFilterState);
  private readonly i18n = inject(I18nService);

  readonly value = input('');
  readonly placeholder = input('');

  readonly valueChange = output<string>();
  /** Die Gruppe, deren Zeichen den Antippenden traf. Öffnet das Filterblatt. */
  readonly groupOpened = output<ChipKey>();

  protected readonly filtered = computed(() => isActive(this.filter.selection()));

  protected readonly showsMarks = computed(
    () => !this.state.loading() && !this.state.failed() && this.value().trim() === '',
  );

  /** Die eine Gruppe mit Wahl, deren Zeichen den Wert zeigt. Ohne Wahl keine. */
  private readonly active = computed<GroupKey | null>(() => {
    const selection = this.filter.selection();
    const names = termNamesOf(this.state.entries());
    return VALUE_GROUPS.find((key) => groupSummary(key, selection, this.i18n, names) !== '') ?? null;
  });

  protected readonly chips = computed(() => {
    const active = this.active();
    const selection = this.filter.selection();
    const names = termNamesOf(this.state.entries());
    return GROUPS.map(({ key, icon }) => {
      if (key === 'all') return { key, icon, label: '', on: this.filtered() };
      const label = this.i18n.translate(GROUP_TEXT[key]);
      if (key !== active) return { key, icon, label, on: false };
      return { key, icon, label: `${label} · ${groupSummary(key, selection, this.i18n, names)}`, on: true };
    });
  });

  protected open(key: ChipKey): void {
    this.filter.openSheet();
    this.groupOpened.emit(key);
  }
}

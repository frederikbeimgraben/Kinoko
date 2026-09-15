import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { GROUP_CARDS, valueLabel } from './filter-groups';
import { GROUP_TEXT, MONTH_TEXT } from './labels';
import { SpeciesFilterState } from './filter.state';
import { SpeciesGroupComponent } from './filter-group.component';
import { SpeciesColourComponent } from './filter-colour.component';
import { SpeciesSizeComponent } from './filter-size.component';
import { SpeciesState } from './species.state';
import type { GroupKey } from './facets';

/** Eine Zeile der Übersicht: Gruppenname und die gewählten Werte. */
interface GroupRow {
  key: GroupKey;
  label: string;
  value: string;
}

/** Der Inhalt des Filters: die Übersicht oder eine Gruppe daraus. */
@Component({
  selector: 'app-species-filter-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, SpeciesColourComponent, SpeciesGroupComponent, SpeciesSizeComponent],
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.scss',
})
export class SpeciesFilterPanelComponent {
  private readonly state = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  protected readonly filter = inject(SpeciesFilterState);

  readonly groups = input<readonly (readonly GroupKey[])[]>(GROUP_CARDS);

  protected readonly cards = computed<GroupRow[][]>(() =>
    this.groups().map((card) => card.map((key) => this.rowOf(key))),
  );

  private termNames(): ReadonlyMap<string, string> {
    const names = new Map<string, string>();
    for (const one of this.state.entries()) {
      for (const held of one.species.terms) names.set(held.term.slug, held.term.name);
    }
    return names;
  }

  private rowOf(key: GroupKey): GroupRow {
    return { key, label: this.i18n.translate(GROUP_TEXT[key]), value: this.valueOf(key) };
  }

  /** Was eine Gruppe in ihrer Zeile zeigt: ein Wert, sonst ihre Zahl. */
  private valueOf(key: GroupKey): string {
    if (key === 'colour') return this.colourValue();
    if (key === 'size') return this.periodValue();
    const chosen = this.filter.chosenIn(key);
    if (chosen.size === 0) return '';
    if (chosen.size > 1) return this.i18n.translate('filter.valueCount', { anzahl: String(chosen.size) });
    return valueLabel(key, [...chosen][0], this.i18n, this.termNames());
  }

  /** Die Gruppe Maße und Zeit nennt den Zeitraum, den sie führt. */
  private periodValue(): string {
    const months = [...this.filter.chosenIn('period')].map(Number).sort((one, other) => one - other);
    if (months.length === 0) return '';
    if (months.length === 1) return this.i18n.translate(MONTH_TEXT[months[0] - 1]);
    return this.i18n.translate('species.period.range', {
      von: this.i18n.translate(MONTH_TEXT[months[0] - 1]),
      bis: this.i18n.translate(MONTH_TEXT[months[months.length - 1] - 1]),
    });
  }

  private colourValue(): string {
    const count = this.filter.selection().colours.size;
    if (count === 0) return '';
    const key = count === 1 ? 'filter.colour.onePart' : 'filter.colour.parts';
    return this.i18n.translate(key, { anzahl: String(count) });
  }
}

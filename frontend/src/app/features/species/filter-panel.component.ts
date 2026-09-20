import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ViewportService } from '../../core/layout/viewport.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BackHeadComponent } from '../../ui/back-head/back-head.component';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import { FoldSectionComponent } from '../../ui/fold-section/fold-section.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { RippleDirective } from '../../ui/ripple/ripple.directive';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { choicesOf, GROUP_CARDS, groupSummary, termNamesOf } from './filter-groups';
import { GROUP_TEXT, groupTitle } from './labels';
import { SpeciesFilterState } from './filter.state';
import { SpeciesColourComponent } from './filter-colour.component';
import { SpeciesGroupComponent } from './filter-group.component';
import { SpeciesState } from './species.state';
import { judge, type GroupKey } from './facets';

/** Eine Zeile der Übersicht: Gruppenname und die gewählten Werte. */
interface GroupRow {
  key: GroupKey;
  label: string;
  value: string;
}

/** Die vier Gruppen, die flach als Zeichen im Blatt stehen. `labelOf` trägt die Beschriftung. */
const FLAT_GROUPS: readonly { key: GroupKey; labelOf: GroupKey }[] = [
  { key: 'edibility', labelOf: 'edibility' },
  { key: 'capShape', labelOf: 'capShape' },
  { key: 'hymenium', labelOf: 'hymenium' },
  { key: 'period', labelOf: 'period' },
];

/** Der Inhalt des Filters: die Übersicht oder eine der übrigen Gruppen daraus. */
@Component({
  selector: 'app-species-filter-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BackHeadComponent,
    ChipGroupComponent,
    FoldSectionComponent,
    ListRowComponent,
    RippleDirective,
    SpeciesColourComponent,
    SpeciesGroupComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.scss',
})
export class SpeciesFilterPanelComponent {
  private readonly state = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  protected readonly filter = inject(SpeciesFilterState);
  /** Am Rechner steht der Kopf der Gruppe in der Spalte statt im Blatt. */
  protected readonly wide = inject(ViewportService).wide;

  protected readonly flatGroups = FLAT_GROUPS;

  protected readonly cards = computed<GroupRow[][]>(() =>
    GROUP_CARDS.map((card) => card.map((key) => this.rowOf(key))),
  );

  protected readonly resettable = computed(() => this.filter.chosenCount() > 0);

  /** Die Zahl der Arten, welche die aktuelle Wahl trifft, für den Kopf am Rechner. */
  protected readonly count = computed(() => {
    const selection = this.filter.selection();
    const palette = this.state.palette();
    const hits = this.state.entries().filter((one) => judge(one.facts, selection, palette) === 'hit').length;
    return this.i18n.translate('filter.countSpecies', { anzahl: String(hits) });
  });

  protected readonly title = computed(() => {
    const group = this.filter.group();
    return group === null ? '' : groupTitle(group, this.i18n);
  });

  protected back(): void {
    this.filter.showGroup(null);
  }

  protected reset(): void {
    this.filter.clearAll();
  }

  /** Die Wahlmöglichkeiten einer flach angezeigten Gruppe, als Zeichen. */
  protected chipsOf(key: GroupKey): readonly Chip[] {
    return choicesOf(this.state.facets(), key, this.i18n, this.termNames()).map((choice) => ({
      value: choice.value,
      label: choice.label,
    }));
  }

  protected chosenIn(key: GroupKey): readonly string[] {
    return [...this.filter.chosenIn(key)];
  }

  protected flatLabel(key: GroupKey): string {
    return this.i18n.translate(GROUP_TEXT[key]);
  }

  /** `ChipGroup` meldet die volle Wahl. Genau ein Wert weicht ab: der getippte. */
  protected chipsChanged(key: GroupKey, next: readonly string[]): void {
    const current = this.filter.chosenIn(key);
    const changed =
      next.find((value) => !current.has(value)) ?? [...current].find((value) => !next.includes(value));
    if (changed !== undefined) this.filter.toggle(key, changed);
  }

  private termNames(): ReadonlyMap<string, string> {
    return termNamesOf(this.state.entries());
  }

  private rowOf(key: GroupKey): GroupRow {
    return {
      key,
      label: this.i18n.translate(GROUP_TEXT[key]),
      value: groupSummary(key, this.filter.selection(), this.i18n, this.termNames()),
    };
  }
}

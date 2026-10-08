import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ViewportService } from '../../core/layout/viewport.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import { FoldSectionComponent } from '../../ui/fold-section/fold-section.component';
import { RippleDirective } from '../../ui/ripple/ripple.directive';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { choicesOf, termNamesOf } from './filter-groups';
import { GROUP_TEXT } from './labels';
import { SpeciesFilterStore } from './filter.store';
import { SpeciesColourComponent } from './filter-colour.component';
import { SpeciesStore } from './species.store';
import { judge, type GroupKey } from './facets';

/** The five groups that the sheet shows flat. `labelOf` gives the label. */
const FLAT_GROUPS: readonly { key: GroupKey; labelOf: GroupKey }[] = [
  { key: 'edibility', labelOf: 'edibility' },
  { key: 'capShape', labelOf: 'capShape' },
  { key: 'hymenium', labelOf: 'hymenium' },
  { key: 'period', labelOf: 'period' },
];

/** The content of the filter: edibility, cap shape, colour, hymenium and time in one column. */
@Component({
  selector: 'app-species-filter-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChipGroupComponent,
    FoldSectionComponent,
    RippleDirective,
    SpeciesColourComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.scss',
})
export class SpeciesFilterPanelComponent {
  private readonly state = inject(SpeciesStore);
  private readonly i18n = inject(I18nService);
  protected readonly filter = inject(SpeciesFilterStore);
  /** On the desktop the head with the count and the reset is above the column. */
  protected readonly wide = inject(ViewportService).wide;

  protected readonly flatGroups = FLAT_GROUPS;

  protected readonly resettable = computed(() => this.filter.chosenCount() > 0);

  /** The count of species that match the current choice, for the head on the desktop. */
  protected readonly count = computed(() => {
    const selection = this.filter.selection();
    const palette = this.state.palette();
    const hits = this.state.entries().filter((one) => judge(one.facts, selection, palette) === 'hit').length;
    return this.i18n.translate('filter.countSpecies', { anzahl: String(hits) });
  });

  protected reset(): void {
    this.filter.clearAll();
  }

  /** The values of a flat group, as chips. */
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

  /** `ChipGroup` gives the full choice. Exactly one value is different: the pressed one. */
  protected chipsChanged(key: GroupKey, next: readonly string[]): void {
    const current = this.filter.chosenIn(key);
    const changed =
      next.find((value) => !current.has(value)) ?? [...current].find((value) => !next.includes(value));
    if (changed !== undefined) this.filter.toggle(key, changed);
  }

  private termNames(): ReadonlyMap<string, string> {
    return termNamesOf(this.state.entries());
  }
}

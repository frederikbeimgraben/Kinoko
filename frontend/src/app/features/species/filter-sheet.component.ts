import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FilterSheetComponent } from '../../ui/filter-sheet/filter-sheet.component';
import { groupTitle } from './labels';
import { SpeciesFilterPanelComponent } from './filter-panel.component';
import { SpeciesFilterStore } from './filter.store';
import { SpeciesStore } from './species.store';
import { judge } from './facets';

/** The filter sheet over the list. */
@Component({
  selector: 'app-species-filter-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterSheetComponent, SpeciesFilterPanelComponent],
  templateUrl: './filter-sheet.component.html',
  styleUrl: './filter-sheet.component.scss',
})
export class SpeciesFilterSheetComponent {
  private readonly state = inject(SpeciesStore);
  private readonly i18n = inject(I18nService);
  protected readonly filter = inject(SpeciesFilterStore);

  protected readonly resettable = computed(() => this.filter.chosenCount() > 0);

  protected readonly title = computed(() => {
    const group = this.filter.group();
    return group === null ? this.i18n.translate('common.filter') : groupTitle(group, this.i18n);
  });

  protected readonly primaryLabel = computed(() => {
    const selection = this.filter.selection();
    const palette = this.state.palette();
    const hits = this.state.entries().filter((one) => judge(one.facts, selection, palette) === 'hit').length;
    return this.i18n.translate('filter.showCount', { anzahl: String(hits) });
  });
}

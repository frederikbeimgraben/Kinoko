import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FilterSheetComponent } from '../../ui/filter-sheet/filter-sheet.component';
import { GROUP_TEXT } from './labels';
import { SpeciesFilterPanelComponent } from './filter-panel.component';
import { SpeciesFilterState } from './filter.state';
import { SpeciesState } from './species.state';
import { judge } from './facets';

/** Das Filterblatt über der Liste. */
@Component({
  selector: 'app-species-filter-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterSheetComponent, SpeciesFilterPanelComponent],
  templateUrl: './filter-sheet.component.html',
  styleUrl: './filter-sheet.component.scss',
})
export class SpeciesFilterSheetComponent {
  private readonly state = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  protected readonly filter = inject(SpeciesFilterState);

  protected readonly resettable = computed(() => this.filter.chosenCount() > 0);

  protected readonly title = computed(() => {
    const group = this.filter.group();
    if (group === null) return this.i18n.translate('common.filter');
    if (group === 'size') return this.i18n.translate('filter.group.sizeTime');
    return this.i18n.translate(GROUP_TEXT[group]);
  });

  protected readonly primaryLabel = computed(() => {
    const selection = this.filter.selection();
    const hits = this.state.entries().filter((one) => judge(one.facts, selection) === 'hit').length;
    return this.i18n.translate('filter.showCount', { anzahl: String(hits) });
  });
}

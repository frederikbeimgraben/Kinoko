import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ViewportService } from '../../core/layout/viewport.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { countUnknown, judge, type GroupKey } from './facets';
import { GROUP_TEXT } from './labels';
import { SpeciesFilterPanelComponent } from './filter-panel.component';
import { SpeciesFilterSheetComponent } from './filter-sheet.component';
import { SpeciesFilterState } from './filter.state';
import { SpeciesResultsComponent } from './species-results.component';
import { SpeciesSearchFilterBarComponent } from './search-filter-bar.component';
import { SpeciesState, type CatalogueEntry } from './species.state';
import { search } from './rows';

const PAGE = 40;

/** Der Reiter Arten: Suche, Filter und die Liste aus dem lokalen Katalog. */
@Component({
  selector: 'app-species-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    SearchFieldComponent,
    SpeciesFilterPanelComponent,
    SpeciesFilterSheetComponent,
    SpeciesResultsComponent,
    SpeciesSearchFilterBarComponent,
    TranslatePipe,
  ],
  templateUrl: './species-list.component.html',
  styleUrl: './species-list.component.scss',
})
export class SpeciesListComponent {
  protected readonly state = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly viewport = inject(ViewportService);
  protected readonly filter = inject(SpeciesFilterState);

  protected readonly query = signal('');
  protected readonly shown = signal(PAGE);

  protected readonly wide = this.viewport.wide;
  protected readonly loading = this.state.loading;
  protected readonly failed = this.state.failed;

  private readonly judged = computed(() => {
    const selection = this.filter.selection();
    const palette = this.state.palette();
    const hits: CatalogueEntry[] = [];
    const unknown: CatalogueEntry[] = [];
    for (const one of search(this.state.entries(), this.query())) {
      const verdict = judge(one.facts, selection, palette);
      if (verdict === 'hit') hits.push(one);
      else if (verdict === 'unknown') unknown.push(one);
    }
    return { hits, unknown };
  });

  protected readonly hits = computed(() => this.judged().hits.slice(0, this.shown()));
  protected readonly unassessable = computed(() => this.judged().unknown);
  protected readonly hasMore = computed(() => this.judged().hits.length > this.shown());

  /** Die Zeile über der Trefferliste: Zahl und, wenn gefiltert, die größte Lücke. */
  protected readonly summary = computed(() => {
    if (this.loading() || this.failed()) return '';
    const count = this.i18n.translate('filter.countSpecies', {
      anzahl: String(this.judged().hits.length),
    });
    const gap = this.largestGap();
    if (gap === null) return count;
    const text = this.i18n.translate('filter.withoutValue', {
      anzahl: String(gap.count),
      gruppe: this.i18n.translate(GROUP_TEXT[gap.key]),
    });
    return `${count} \u00b7 ${text}`;
  });

  constructor() {
    void this.state.loadBundle();
    effect(() => {
      this.query();
      this.filter.selection();
      this.shown.set(PAGE);
    });
  }

  protected open(slug: string): void {
    void this.router.navigate(['/arten', slug]);
  }

  protected more(): void {
    this.shown.update((count) => count + PAGE);
  }

  protected reset(): void {
    this.filter.clearAll();
  }

  private largestGap(): { key: GroupKey; count: number } | null {
    const counts = this.state.facets();
    let widest: { key: GroupKey; count: number } | null = null;
    for (const key of this.filter.selection().values.keys()) {
      const count = countUnknown(counts, key);
      if (count > 0 && (widest === null || count > widest.count)) widest = { key, count };
    }
    return widest;
  }
}

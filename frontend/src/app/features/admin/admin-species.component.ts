import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { FloatingButtonComponent } from '../../ui/floating-button/floating-button.component';
import { InfiniteListComponent } from '../../ui/infinite-list/infinite-list.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { SpeciesRowComponent } from '../../ui/species-row/species-row.component';
import { judge } from '../species/facets';
import { SpeciesFilterSheetComponent } from '../species/filter-sheet.component';
import { SpeciesFilterStore } from '../species/filter.store';
import { SpeciesSearchFilterBarComponent } from '../species/search-filter-bar.component';
import { search } from '../species/rows';
import { resultRows, type ResultRow } from '../species/species-results.component';
import { SpeciesStore } from '../species/species.store';

const PAGE = 40;

/** The species administration: a search, the filter, the list and the floating button that creates a species. */
@Component({
  selector: 'app-admin-species',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FloatingButtonComponent,
    InfiniteListComponent,
    PageHeaderComponent,
    RowGroupSkeletonComponent,
    SpeciesFilterSheetComponent,
    SpeciesRowComponent,
    SpeciesSearchFilterBarComponent,
    TranslatePipe,
  ],
  templateUrl: './admin-species.component.html',
  styleUrl: './admin-species.component.scss',
})
export class AdminSpeciesComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly catalogue = inject(SpeciesStore);
  protected readonly filter = inject(SpeciesFilterStore);

  protected readonly wide = inject(ViewportService).wide;
  protected readonly loading = this.catalogue.loading;
  protected readonly query = signal('');
  protected readonly shown = signal(PAGE);

  private readonly hits = computed(() => {
    const selection = this.filter.selection();
    const palette = this.catalogue.palette();
    return search(this.catalogue.entries(), this.query()).filter(
      (one) => judge(one.facts, selection, palette) !== 'miss',
    );
  });

  protected readonly hasMore = computed(() => this.hits().length > this.shown());

  /** The rows of the species list: thumb, names, edibility and a letter head for each group. */
  protected readonly rows = computed<ResultRow[]>(() =>
    resultRows(this.hits().slice(0, this.shown()), 'name', this.i18n),
  );

  constructor() {
    void this.catalogue.loadBundle();
  }

  protected find(value: string): void {
    this.query.set(value);
    this.shown.set(PAGE);
  }

  protected more(): void {
    this.shown.update((count) => count + PAGE);
  }

  protected open(slug: string): void {
    void this.router.navigate(['/verwaltung/arten', slug]);
  }

  protected create(): void {
    void this.router.navigate(['/verwaltung/arten', 'neu']);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { InfiniteListComponent } from '../../ui/infinite-list/infinite-list.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { judge } from '../species/facets';
import { SpeciesFilterSheetComponent } from '../species/filter-sheet.component';
import { SpeciesFilterState } from '../species/filter.state';
import { SpeciesSearchFilterBarComponent } from '../species/search-filter-bar.component';
import { search } from '../species/rows';
import { SpeciesState } from '../species/species.state';

const PAGE = 40;

/** A row of the species administration. */
interface Row {
  slug: string;
  name: string;
  latin: string;
  forecast: boolean;
}

/** The species administration: a search, the filter and the way to create a species. */
@Component({
  selector: 'app-admin-species',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddRowComponent,
    InfiniteListComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SpeciesFilterSheetComponent,
    SpeciesSearchFilterBarComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './admin-species.component.html',
  styleUrl: './admin-species.component.scss',
})
export class AdminSpeciesComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly catalogue = inject(SpeciesState);
  protected readonly filter = inject(SpeciesFilterState);

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

  protected readonly rows = computed<Row[]>(() =>
    this.hits()
      .slice(0, this.shown())
      .map((one) => ({
        slug: one.species.slug,
        name: one.species.name,
        latin: one.species.scientificName,
        forecast: one.species.forecastEnabled,
      })),
  );

  protected readonly noForecast = computed(() => this.i18n.translate('admin.species.noForecast'));

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

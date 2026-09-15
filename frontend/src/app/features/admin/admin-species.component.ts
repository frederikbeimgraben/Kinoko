import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { grouped } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { InfiniteListComponent } from '../../ui/infinite-list/infinite-list.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { judge } from '../species/facets';
import { SpeciesFilterSheetComponent } from '../species/filter-sheet.component';
import { SpeciesFilterState } from '../species/filter.state';
import { search } from '../species/rows';
import { SpeciesState } from '../species/species.state';
import { AdminSpeciesState } from './admin-species.state';

const PAGE = 40;

/** Die Spalten der Zahlen, in der Reihenfolge des Bretts. */
const COLUMNS = ['data', 'finds', 'photos'] as const;

/** Eine Zeile der Artenverwaltung. */
interface Row {
  slug: string;
  name: string;
  latin: string;
  counts: readonly string[];
  forecast: boolean;
}

/** Die Artenverwaltung: Suche, Filter, Zahlen je Art und der Weg zum Anlegen. */
@Component({
  selector: 'app-admin-species',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddRowComponent,
    InfiniteListComponent,
    ListRowComponent,
    PageHeaderComponent,
    SearchFieldComponent,
    SpeciesFilterSheetComponent,
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
  private readonly admin = inject(AdminSpeciesState);
  protected readonly filter = inject(SpeciesFilterState);

  protected readonly columns = COLUMNS;
  protected readonly query = signal('');
  protected readonly shown = signal(PAGE);
  protected readonly loading = this.catalogue.loading;

  private readonly hits = computed(() => {
    const selection = this.filter.selection();
    const palette = this.catalogue.palette();
    return search(this.catalogue.entries(), this.query()).filter(
      (one) => judge(one.facts, selection, palette) !== 'miss',
    );
  });

  protected readonly hasMore = computed(() => this.hits().length > this.shown());

  protected readonly rows = computed<Row[]>(() => {
    const counts = this.admin.counts();
    return this.hits()
      .slice(0, this.shown())
      .map((one) => {
        const tally = counts.get(one.species.id);
        return {
          slug: one.species.slug,
          name: one.species.name,
          latin: one.species.scientificName,
          counts: [tally?.records ?? 0, tally?.finds ?? 0, tally?.photos ?? 0].map(grouped),
          forecast: one.species.forecastEnabled,
        };
      });
  });

  protected readonly noForecast = computed(() => this.i18n.translate('admin.species.noForecast'));

  constructor() {
    void this.catalogue.loadBundle();
    this.admin.load();
  }

  protected columnTitle(column: (typeof COLUMNS)[number]): string {
    return this.i18n.translate(`admin.species.column.${column}` as 'admin.species.column.data');
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

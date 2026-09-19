import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { InfiniteListComponent } from '../../ui/infinite-list/infinite-list.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { judge } from '../species/facets';
import { SpeciesFilterSheetComponent } from '../species/filter-sheet.component';
import { SpeciesFilterState } from '../species/filter.state';
import { SpeciesSearchFilterBarComponent } from '../species/search-filter-bar.component';
import { search } from '../species/rows';
import { SpeciesState } from '../species/species.state';

const PAGE = 40;

/** Eine Zeile der Artenverwaltung. */
interface Row {
  slug: string;
  name: string;
  latin: string;
  forecast: boolean;
}

/** Die Artenverwaltung: Suche, Filter je Art und der Weg zum Anlegen. */
@Component({
  selector: 'app-admin-species',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddRowComponent,
    InfiniteListComponent,
    ListRowComponent,
    PageHeaderComponent,
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

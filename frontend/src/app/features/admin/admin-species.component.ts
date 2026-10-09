import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { FloatingButtonComponent } from '../../ui/floating-button/floating-button.component';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { InfiniteListComponent } from '../../ui/infinite-list/infinite-list.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PopoverComponent, type PopoverAnchor } from '../../ui/popover/popover.component';
import { PopoverItemComponent } from '../../ui/popover/popover-item.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { SpeciesRowComponent } from '../../ui/species-row/species-row.component';
import { judge } from '../species/facets';
import { SpeciesFilterChipsComponent } from '../species/filter-chips.component';
import { SpeciesFilterSheetComponent } from '../species/filter-sheet.component';
import { SPECIES_SORTS, SpeciesFilterStore, type SpeciesSort } from '../species/filter.store';
import { search, sortEntries } from '../species/rows';
import { SORT_TEXT } from '../species/species-search-bar.component';
import { resultRows, type ResultRow } from '../species/species-results.component';
import { SpeciesStore } from '../species/species.store';

const PAGE = 40;

/** The sort popover opens below the sort button, the last button of the head. */
const ANCHOR: Readonly<Record<'phone' | 'desk', PopoverAnchor>> = {
  phone: { top: 60, end: 8 },
  desk: { top: 64, end: 12 },
};

/** The species administration per the board `AdminSpecies`: the search and the sort in the head,
 * the filter chips, the list and the floating button that creates a species. */
@Component({
  selector: 'app-admin-species',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FloatingButtonComponent,
    IconButtonComponent,
    InfiniteListComponent,
    PageHeaderComponent,
    PopoverComponent,
    PopoverItemComponent,
    RowGroupSkeletonComponent,
    SearchFieldComponent,
    SpeciesFilterChipsComponent,
    SpeciesFilterSheetComponent,
    SpeciesRowComponent,
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
  protected readonly sorting = signal(false);
  protected readonly anchor = computed(() => (this.wide() ? ANCHOR.desk : ANCHOR.phone));

  /** The chips hide while a search text is present, as on the species list. */
  protected readonly marks = computed(
    () => !this.catalogue.loading() && !this.catalogue.failed() && this.query().trim() === '',
  );

  protected readonly sorts = computed(() =>
    SPECIES_SORTS.map((key) => ({
      key,
      label: this.i18n.translate(SORT_TEXT[key]),
      on: key === this.filter.sort(),
    })),
  );

  private readonly hits = computed(() => {
    const selection = this.filter.selection();
    const palette = this.catalogue.palette();
    const found = search(this.catalogue.entries(), this.query()).filter(
      (one) => judge(one.facts, selection, palette) !== 'miss',
    );
    return sortEntries(found, this.filter.sort());
  });

  protected readonly hasMore = computed(() => this.hits().length > this.shown());

  /** The rows of the species list: thumb, names, edibility and a letter head for each group. */
  protected readonly rows = computed<ResultRow[]>(() =>
    resultRows(this.hits().slice(0, this.shown()), this.filter.sort(), this.i18n),
  );

  constructor() {
    void this.catalogue.loadBundle();
  }

  protected find(value: string): void {
    this.query.set(value);
    this.shown.set(PAGE);
  }

  protected setSort(sort: SpeciesSort): void {
    this.filter.setSort(sort);
    this.sorting.set(false);
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

import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { InfiniteListComponent } from '../../ui/infinite-list/infinite-list.component';
import { SkeletonComponent } from '../../ui/skeleton/skeleton.component';
import { SpeciesRowComponent, type SpeciesRowSpecies } from '../../ui/species-row/species-row.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import type { SpeciesSort } from './filter.store';
import { headOf, speciesRow } from './rows';
import type { CatalogueEntry } from './species.store';

/** The rows of the skeleton, per `SpeciesSkeleton.dc.html`. */
const SKELETON_ROWS = 7;

/** One row of the list, with the head that starts its group. */
export interface ResultRow {
  readonly slug: string;
  readonly species: SpeciesRowSpecies;
  /** The head above the row. Empty when the row continues the group above. */
  readonly head: string;
}

/** Makes the rows of a sorted list. A head shows where the group changes. */
export function resultRows(
  entries: readonly CatalogueEntry[],
  sort: SpeciesSort,
  i18n: I18nService,
): ResultRow[] {
  const heads = entries.map((one) => headOf(one.species, sort, i18n));
  return entries.map((one, index) => ({
    slug: one.species.slug,
    species: speciesRow(one.species, i18n),
    head: heads[index] !== '' && heads[index] !== heads[index - 1] ? heads[index] : '',
  }));
}

/** The species list with its four states: error, loading, empty and the rows. */
@Component({
  selector: 'app-species-results',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    InfiniteListComponent,
    NgTemplateOutlet,
    SkeletonComponent,
    SpeciesRowComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './species-results.component.html',
  styleUrl: './species-results.component.scss',
})
export class SpeciesResultsComponent {
  private readonly i18n = inject(I18nService);

  readonly hits = input.required<readonly CatalogueEntry[]>();
  readonly unassessable = input<readonly CatalogueEntry[]>([]);
  readonly sort = input<SpeciesSort>('name');
  readonly loading = input(false);
  readonly failed = input(false);
  /** True when a filter is set. Only then does the empty state offer to reset it, per `SpeciesEmpty.dc.html`. */
  readonly filtered = input(false);
  readonly hasMore = input(false);
  /** The species of the open page: its row is selected. */
  readonly active = input<string | null>(null);
  /** The species that the person opened last: its row has the soft ground. */
  readonly soft = input<string | null>(null);

  readonly chosen = output<string>();
  readonly more = output();
  readonly retry = output();
  readonly resetFilter = output();

  protected readonly skeletonRows = SKELETON_ROWS;

  protected readonly rows = computed(() => resultRows(this.hits(), this.sort(), this.i18n));

  protected readonly gapRows = computed(() =>
    this.unassessable().map((one) => ({
      slug: one.species.slug,
      species: speciesRow(one.species, this.i18n),
    })),
  );

  protected readonly gapText = computed(() =>
    this.i18n.translate('filter.notJudgeableCount', { anzahl: String(this.unassessable().length) }),
  );
}

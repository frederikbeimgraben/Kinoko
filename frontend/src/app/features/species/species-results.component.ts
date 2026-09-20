import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { InfiniteListComponent } from '../../ui/infinite-list/infinite-list.component';
import { SkeletonComponent } from '../../ui/skeleton/skeleton.component';
import { SpeciesRowComponent } from '../../ui/species-row/species-row.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { speciesRow } from './rows';
import type { CatalogueEntry } from './species.state';

const SKELETON_ROWS = 5;

/** Die Liste der Arten mit ihren vier Zuständen. */
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
  readonly loading = input(false);
  readonly failed = input(false);
  readonly hasMore = input(false);
  readonly active = input<string | null>(null);

  readonly chosen = output<string>();
  readonly more = output();
  readonly retry = output();
  readonly resetFilter = output();

  protected readonly skeletons = Array.from({ length: SKELETON_ROWS }, (_, at) => at);

  protected readonly rows = computed(() =>
    this.hits().map((one) => ({ slug: one.species.slug, species: speciesRow(one.species, this.i18n) })),
  );

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

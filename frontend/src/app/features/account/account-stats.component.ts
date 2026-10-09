import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { grouped } from '../../core/i18n/numbers';
import type { TranslationKey } from '../../core/i18n/translations';
import { SkeletonComponent } from '../../ui/skeleton/skeleton.component';
import { StatRowComponent, type Stat } from '../../ui/stat-row/stat-row.component';
import { MyDataStore, type DataCounts } from './my-data.store';

/** The labels take the count, so that one tile says "1 Fund" and not "1 Funde". */
const LABELS: Readonly<Record<keyof DataCounts, TranslationKey>> = {
  finds: 'account.stat.finds',
  markers: 'account.stat.markers',
  zones: 'account.stat.zones',
  photos: 'account.stat.images',
  combinations: 'account.stat.combinations',
};

const ORDER: readonly (keyof DataCounts)[] = ['finds', 'markers', 'zones', 'photos', 'combinations'];

/** The counts of the own data as kit `.tiles`. While the counts load, the tiles are a skeleton. */
@Component({
  selector: 'app-account-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, StatRowComponent],
  templateUrl: './account-stats.component.html',
})
export class AccountStatsComponent {
  private readonly data = inject(MyDataStore);
  private readonly i18n = inject(I18nService);

  readonly cols = input(3);
  /** Without combinations, as `MyData.dc.html` shows the tiles. */
  readonly withCombinations = input(true);

  private readonly parts = computed(() =>
    this.withCombinations() ? ORDER : ORDER.filter((part) => part !== 'combinations'),
  );

  protected readonly count = computed(() => this.parts().length);

  protected readonly stats = computed<readonly Stat[] | null>(() => {
    const counts = this.data.counts();
    return counts === null
      ? null
      : this.parts().map((part) => ({
          value: grouped(counts[part]),
          label: this.i18n.translate(LABELS[part], { count: counts[part] }),
        }));
  });

  constructor() {
    this.data.refresh();
  }
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { shortMonth } from '../../../core/i18n/dates';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TileService } from '../../../core/tiles/tile.service';
import {
  SeasonCurveComponent,
  type MonthMark,
  type SeasonSeries,
} from '../../../ui/season-curve/season-curve.component';
import { seasonData } from './season';

/** Die Wochen, in denen ein Monatsname unter der Kurve steht. `at` zählt von 1 bis 12. */
const MARKS: readonly { at: number; week: number }[] = [
  { at: 1, week: 1 },
  { at: 4, week: 14 },
  { at: 7, week: 27 },
  { at: 10, week: 40 },
  { at: 12, week: 49 },
];

const PERCENT = 100;

/** Die Saison einer Art aus dem Manifest der Karte. Ohne Karte bleibt sie weg. */
@Component({
  selector: 'app-species-season',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SeasonCurveComponent, TranslatePipe],
  templateUrl: './species-season.component.html',
  styleUrl: './species-season.component.scss',
})
export class SpeciesSeasonComponent {
  private readonly tiles = inject(TileService);
  private readonly i18n = inject(I18nService);

  readonly slug = input.required<string>();

  protected readonly data = computed(() => seasonData(this.tiles.manifestOf(this.slug())));

  protected readonly series = computed<readonly SeasonSeries[]>(() => {
    const held = this.data();
    if (held === null) return [];
    return [
      {
        shape: 'area',
        values: held.past,
        legend: this.i18n.translate('species.season.past', { von: held.from, bis: held.to }),
      },
      {
        shape: 'line',
        values: held.current,
        legend: this.i18n.translate('species.season.current', { jahr: held.year, woche: held.week }),
      },
    ];
  });

  protected readonly peak = computed(() => {
    const top = this.tiles.manifestOf(this.slug())?.top;
    return top === undefined ? '' : `${String(Math.round(top * PERCENT))} %`;
  });

  protected readonly months = computed<readonly MonthMark[]>(() =>
    MARKS.map((mark) => ({
      text: shortMonth(mark.at, this.i18n),
      week: mark.week,
    })),
  );

  constructor() {
    effect(() => {
      void this.tiles.load(this.slug());
    });
  }
}

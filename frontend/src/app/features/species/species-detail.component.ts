import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LevelPillComponent } from '../../ui/level-pill/level-pill.component';
import { YearBandComponent } from '../../ui/year-band/year-band.component';
import type { SpeciesEntry } from '../../core/api/models';
import {
  DIMENSION_TEXT,
  EDIBILITY_TEXT,
  EDIBILITY_TONE,
  GROUP_NAME_TEXT,
  MONTH_TEXT,
  PART_TEXT,
  PROTECTION_TEXT,
} from './labels';
import { SpeciesState } from './species.state';

const MONTHS = [MONTH_TEXT[0], MONTH_TEXT[3], MONTH_TEXT[6], MONTH_TEXT[9]];

/** Eine Strecke eines Körperteils. */
interface Extent {
  label: string;
  low: number;
  high: number;
  unit: string;
}

/** Ein Körperteil mit seinen Strecken. */
interface Part {
  label: string;
  extents: Extent[];
}

/** Die strukturierten Daten einer Art: Einstufung, Maße, Zeit. */
@Component({
  selector: 'app-species-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LevelPillComponent, TranslatePipe, YearBandComponent],
  templateUrl: './species-detail.component.html',
  styleUrl: './species-detail.component.scss',
})
export class SpeciesDetailComponent {
  private readonly state = inject(SpeciesState);
  private readonly i18n = inject(I18nService);

  readonly slug = input.required<string | null>();

  protected readonly entry = computed<SpeciesEntry | null>(() => {
    const slug = this.slug();
    return slug === null ? null : this.state.entryOf(slug);
  });

  protected readonly subtitle = computed(() => {
    const held = this.entry();
    if (held === null) return '';
    const group = this.i18n.translate(GROUP_NAME_TEXT[held.group]);
    return `${held.scientificName} \u00b7 ${group}`;
  });

  protected readonly edibility = computed(() => {
    const held = this.entry();
    if (held === null) return null;
    return {
      text: this.i18n.translate(EDIBILITY_TEXT[held.edibility]),
      ...EDIBILITY_TONE[held.edibility],
    };
  });

  protected readonly protection = computed(() => {
    const held = this.entry();
    return held === null ? '' : this.i18n.translate(PROTECTION_TEXT[held.protection]);
  });

  protected readonly parts = computed<Part[]>(() =>
    (this.entry()?.measurements ?? []).map((group) => ({
      label: this.i18n.translate(PART_TEXT[group.part]),
      extents: group.measurements.map((one) => ({
        label: this.i18n.translate(DIMENSION_TEXT[one.dimension]),
        low: one.low,
        high: one.high,
        unit: one.unit,
      })),
    })),
  );

  protected readonly period = computed(() => {
    const held = this.entry();
    const from = held?.periodStartMonth;
    const to = held?.periodEndMonth;
    if (!from || !to) return null;
    return {
      from,
      to,
      text: this.i18n.translate('species.period.range', {
        von: this.i18n.translate(MONTH_TEXT[from - 1]),
        bis: this.i18n.translate(MONTH_TEXT[to - 1]),
      }),
    };
  });

  protected readonly marks = MONTHS.map((month) => this.i18n.translate(month).slice(0, 3));
}

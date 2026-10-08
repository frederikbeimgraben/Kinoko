import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { BodyPart, Dimension, Measurement, MeasurementGroup, Unit } from '../../core/api/models';
import { DIMENSIONS } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { DIMENSION_TEXT, PART_TEXT } from '../species/labels';
import { SpeciesEditorStore } from './species-editor.store';
import { SIZE_TITLE, measurementOf, withMeasurement } from './section-size.rows';
import { withoutMeasurement } from './species-lists';

/** One measurement of a part: the dimension, the span, the unit and the rare limits. */
@Component({
  selector: 'app-section-size',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, FormFieldComponent, PageHeaderComponent, SegmentedComponent, TranslatePipe],
  templateUrl: './section-size.component.html',
  styleUrl: './section-size.component.scss',
})
export class SectionSizeComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorStore);

  protected readonly slug = injectRouteParam('slug');
  private readonly partParam = injectRouteParam('part', 'cap');
  protected readonly part = computed(() => this.partParam() as BodyPart);
  protected readonly dimension = signal<Dimension>('width');

  private readonly chosen = computed<Measurement | null>(() =>
    measurementOf(this.state.species(), this.part(), this.dimension()),
  );

  protected readonly low = linkedSignal(() => valueText(this.chosen()?.low));
  protected readonly high = linkedSignal(() => valueText(this.chosen()?.high));

  protected readonly title = computed(() =>
    this.i18n.translate(SIZE_TITLE[this.dimension()], {
      teil: this.i18n.translate(PART_TEXT[this.part()]),
    }),
  );

  protected readonly choices = computed<SegmentOption[]>(() =>
    DIMENSIONS.map((one) => ({ value: one, label: this.i18n.translate(DIMENSION_TEXT[one]) })),
  );

  protected readonly unit = computed<Unit>(() => this.chosen()?.unit ?? 'cm');

  constructor() {
    this.state.load(this.slug);
  }

  protected chooseDimension(value: string): void {
    this.dimension.set(value as Dimension);
  }

  protected apply(): void {
    const species = this.state.species();
    if (species === null) return;
    const groups: MeasurementGroup[] = withMeasurement(species, this.part(), {
      dimension: this.dimension(),
      unit: this.unit(),
      low: Number(this.low()),
      high: Number(this.high()),
    });
    this.state.save({ measurements: groups });
    this.back();
  }

  protected remove(): void {
    const measurements = withoutMeasurement(this.state.species(), this.part(), this.dimension());
    this.state.save({ measurements });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  protected label(key: TranslationKey): string {
    return this.i18n.translate(key);
  }
}

/** A field shows no text for a measurement that does not exist. */
function valueText(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

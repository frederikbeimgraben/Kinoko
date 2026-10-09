import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import type { BodyPart, Dimension, Measurement, MeasurementGroup, Unit } from '../../core/api/models';
import { DIMENSIONS, UNITS } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { decimal } from '../../core/i18n/numbers';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SectionComponent } from '../../ui/section/section.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { DIMENSION_TEXT, PART_TEXT } from '../species/labels';
import { SpeciesEditorStore } from './species-editor.store';
import { measurementOf, numberOf, withMeasurement } from './section-size.rows';
import { UNIT_TEXT } from './species-editor.rows';
import { isBodyPart, withoutMeasurement } from './species-lists';

/** One measurement of a part: the dimension, the span, the unit and the rare limits. */
@Component({
  selector: 'app-section-size',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FormFieldComponent,
    PageHeaderComponent,
    SectionComponent,
    SegmentedComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './section-size.component.html',
  styleUrl: './section-size.component.scss',
})
export class SectionSizeComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorStore);

  protected readonly slug = injectRouteParam('slug');
  private readonly partParam = injectRouteParam('part', 'cap');
  /** A route with an unknown part, for example `hut`, shows the not-found state. */
  protected readonly part = computed<BodyPart | null>(() => {
    const value = this.partParam();
    return isBodyPart(value) ? value : null;
  });
  /** The row of the part page names the dimension in the query, for example `?dimension=height`. */
  private readonly asked = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('dimension') ?? '')),
    { initialValue: '' },
  );
  protected readonly dimension = linkedSignal<Dimension>(() => {
    const asked = this.asked();
    return DIMENSIONS.find((one) => one === asked) ?? 'width';
  });

  private readonly chosen = computed<Measurement | null>(() => {
    const part = this.part();
    return part === null ? null : measurementOf(this.state.species(), part, this.dimension());
  });

  protected readonly low = linkedSignal(() => valueText(this.chosen()?.low, this.i18n.locale()));
  protected readonly high = linkedSignal(() => valueText(this.chosen()?.high, this.i18n.locale()));
  protected readonly unit = linkedSignal<Unit>(() => this.chosen()?.unit ?? 'cm');

  protected readonly title = computed(() => {
    const part = this.part();
    return part === null
      ? this.i18n.translate('error.notFound')
      : this.i18n.translate('admin.size.title', { teil: this.i18n.translate(PART_TEXT[part]) });
  });

  protected readonly choices = computed<SegmentOption[]>(() =>
    DIMENSIONS.map((one) => ({ value: one, label: this.i18n.translate(DIMENSION_TEXT[one]) })),
  );

  protected readonly units = computed<SegmentOption[]>(() =>
    UNITS.map((one) => ({ value: one, label: this.i18n.translate(UNIT_TEXT[one]) })),
  );

  protected readonly unitText = computed(() => this.i18n.translate(UNIT_TEXT[this.unit()]));

  /** Both limits are numbers and the lower limit is not above the upper limit. */
  protected readonly valid = computed(() => {
    const low = numberOf(this.low());
    const high = numberOf(this.high());
    return low !== null && high !== null && low <= high;
  });

  constructor() {
    this.state.load(this.slug);
  }

  protected chooseDimension(value: string): void {
    this.dimension.set(value as Dimension);
  }

  protected chooseUnit(value: string): void {
    this.unit.set(value as Unit);
  }

  protected apply(): void {
    const species = this.state.species();
    const part = this.part();
    if (species === null || part === null || !this.valid()) return;
    const groups: MeasurementGroup[] = withMeasurement(species, part, {
      dimension: this.dimension(),
      unit: this.unit(),
      low: numberOf(this.low()) ?? 0,
      high: numberOf(this.high()) ?? 0,
    });
    this.state.save({ measurements: groups });
    this.back();
  }

  protected remove(): void {
    const part = this.part();
    if (part === null) return;
    const measurements = withoutMeasurement(this.state.species(), part, this.dimension());
    this.state.save({ measurements });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }
}

/** A field shows no text for a measurement that does not exist. A German field shows `0,7`. */
function valueText(value: number | undefined, locale: string): string {
  return value === undefined ? '' : decimal(value, locale, { maximumFractionDigits: 3, useGrouping: false });
}

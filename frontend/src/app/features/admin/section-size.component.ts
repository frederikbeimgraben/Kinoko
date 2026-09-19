import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { BodyPart, Dimension, Measurement, MeasurementGroup, Unit } from '../../core/api/models';
import { DIMENSIONS } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { DIMENSION_TEXT, PART_TEXT } from '../species/labels';
import { SpeciesEditorState } from './species-editor.state';
import { SIZE_TITLE, measurementOf, withMeasurement } from './section-size.rows';
import { withoutMeasurement } from './species-lists';

/** Ein Maß eines Teils: Strecke, Spanne, Einheit und der seltene Rand. */
@Component({
  selector: 'app-section-size',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, FormFieldComponent, PageHeaderComponent, SegmentedComponent, TranslatePipe],
  templateUrl: './section-size.component.html',
  styleUrl: './section-size.component.scss',
})
export class SectionSizeComponent {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorState);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly slug = computed(() => this.params().get('slug') ?? '');
  protected readonly part = computed(() => (this.params().get('part') ?? 'cap') as BodyPart);
  protected readonly dimension = signal<Dimension>('width');

  private readonly chosen = computed<Measurement | null>(() =>
    measurementOf(this.state.species(), this.part(), this.dimension()),
  );

  protected readonly low = signal('');
  protected readonly high = signal('');
  protected readonly rare = signal('');

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
    effect(() => {
      const slug = this.slug();
      if (slug !== '') this.state.load(slug);
    });
    effect(() => {
      const one = this.chosen();
      this.low.set(one === null ? '' : String(one.low));
      this.high.set(one === null ? '' : String(one.high));
      this.rare.set(one?.rareHigh === null || one?.rareHigh === undefined ? '' : String(one.rareHigh));
    });
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
      rareLow: this.chosen()?.rareLow ?? null,
      rareHigh: this.rare() === '' ? null : Number(this.rare()),
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

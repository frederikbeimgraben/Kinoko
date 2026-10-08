import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { YearBandInputComponent } from '../../ui/year-band-input/year-band-input.component';
import { SpeciesEditorStore } from './species-editor.store';

const FIRST_MONTH = 1;
const LAST_MONTH = 12;

/** The season of a species: a band and two months. */
@Component({
  selector: 'app-section-season',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FormFieldComponent,
    PageHeaderComponent,
    TranslatePipe,
    YearBandInputComponent,
  ],
  templateUrl: './section-season.component.html',
  styleUrl: './section-season.component.scss',
})
export class SectionSeasonComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorStore);

  protected readonly slug = injectRouteParam('slug');
  protected readonly from = linkedSignal(() => this.state.species()?.periodStartMonth ?? FIRST_MONTH);
  protected readonly to = linkedSignal(() => this.state.species()?.periodEndMonth ?? LAST_MONTH);

  protected readonly fromName = computed(() => this.monthName(this.from()));
  protected readonly toName = computed(() => this.monthName(this.to()));

  constructor() {
    this.state.load(this.slug);
  }

  protected apply(): void {
    this.state.save({ periodStartMonth: this.from(), periodEndMonth: this.to() });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  /** The full name of the month in the language of the device. */
  private monthName(month: number): string {
    const date = new Date(2026, month - 1, 1);
    return new Intl.DateTimeFormat(this.i18n.locale(), { month: 'long' }).format(date);
  }
}

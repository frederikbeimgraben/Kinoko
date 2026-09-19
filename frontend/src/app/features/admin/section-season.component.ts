import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { YearBandInputComponent } from '../../ui/year-band-input/year-band-input.component';
import { SpeciesEditorState } from './species-editor.state';

const FIRST_MONTH = 1;
const LAST_MONTH = 12;

/** Die Wachstumszeit einer Art: ein Band und zwei Monate. */
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
  private readonly state = inject(SpeciesEditorState);

  protected readonly slug = injectRouteParam('slug');
  protected readonly from = signal(FIRST_MONTH);
  protected readonly to = signal(LAST_MONTH);

  protected readonly fromName = computed(() => this.monthName(this.from()));
  protected readonly toName = computed(() => this.monthName(this.to()));

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug !== '') this.state.load(slug);
    });
    effect(() => {
      const species = this.state.species();
      if (species === null) return;
      this.from.set(species.periodStartMonth ?? FIRST_MONTH);
      this.to.set(species.periodEndMonth ?? LAST_MONTH);
    });
  }

  protected apply(): void {
    this.state.save({ periodStartMonth: this.from(), periodEndMonth: this.to() });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  /** Der Monat in der Sprache des Geräts, ausgeschrieben. */
  private monthName(month: number): string {
    const date = new Date(2026, month - 1, 1);
    return new Intl.DateTimeFormat(this.i18n.locale(), { month: 'long' }).format(date);
  }
}

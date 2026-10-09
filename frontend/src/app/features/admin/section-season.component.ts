import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OptionSheetComponent, type OptionSheetOption } from '../../ui/option-sheet/option-sheet.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { YearBandInputComponent } from '../../ui/year-band-input/year-band-input.component';
import { SpeciesEditorStore } from './species-editor.store';

const FIRST_MONTH = 1;
const LAST_MONTH = 12;
const MONTHS = Array.from({ length: LAST_MONTH }, (_, at) => at + FIRST_MONTH);

/** The month that a sheet chooses. */
type MonthField = 'from' | 'to' | 'peak';

const FIELD_TEXT: Readonly<Record<MonthField, TranslationKey>> = {
  from: 'common.from',
  to: 'common.to',
  peak: 'admin.season.peak',
};

/** The season of a species: a band, the first and the last month and the month with the most finds. */
@Component({
  selector: 'app-section-season',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ListRowComponent,
    OptionSheetComponent,
    PageHeaderComponent,
    RowGroupComponent,
    SectionComponent,
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
  protected readonly peak = linkedSignal<number | null>(() => this.state.species()?.periodPeakMonth ?? null);
  protected readonly picking = signal<MonthField | null>(null);

  protected readonly fromName = computed(() => this.monthName(this.from()));
  protected readonly toName = computed(() => this.monthName(this.to()));
  protected readonly peakName = computed(() => {
    const peak = this.peak();
    return peak === null ? this.i18n.translate('common.none') : this.monthName(peak);
  });

  protected readonly pickTitle = computed(() => {
    const field = this.picking();
    return field === null ? '' : this.i18n.translate(FIELD_TEXT[field]);
  });

  protected readonly months = computed<OptionSheetOption[]>(() =>
    MONTHS.map((month) => ({ id: String(month), title: this.monthName(month) })),
  );

  protected readonly picked = computed(() => {
    const field = this.picking();
    if (field === null) return null;
    const value = field === 'from' ? this.from() : field === 'to' ? this.to() : this.peak();
    return value === null ? null : String(value);
  });

  constructor() {
    this.state.load(this.slug);
  }

  protected choose(id: string): void {
    const month = Number(id);
    const field = this.picking();
    if (field === 'from') this.from.set(month);
    if (field === 'to') this.to.set(month);
    if (field === 'peak') this.peak.set(month);
    this.picking.set(null);
  }

  protected apply(): void {
    this.state.save({
      periodStartMonth: this.from(),
      periodEndMonth: this.to(),
      periodPeakMonth: this.peak(),
    });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  private monthName(month: number): string {
    return this.i18n.translate(`enum.month.${String(month)}` as TranslationKey);
  }
}

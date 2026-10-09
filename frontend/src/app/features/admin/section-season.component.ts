import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { HistoryService } from '../../core/navigation/history.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OptionSheetComponent, type OptionSheetOption } from '../../ui/option-sheet/option-sheet.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { SpeciesEditorStore } from './species-editor.store';
import { WEEKS, curvePaths, monthOfWeek, seasonCurve, startWeek } from './section-season.rows';

const FIRST_MONTH = 1;
const LAST_MONTH = 12;
const MONTHS = Array.from({ length: LAST_MONTH }, (_, at) => at + FIRST_MONTH);
/** The calendar weeks. A year can have a 53rd week. */
const CALENDAR_WEEKS = Array.from({ length: WEEKS + 1 }, (_, at) => at + 1);
/** The months below the curve, as the board EditSeason shows them. */
const CURVE_MONTHS = [1, 4, 7, 10, 12] as const;
/** The size of the drawing. The SVG stretches it to the width of the card. */
const CURVE_WIDTH = 334;
const CURVE_HEIGHT = 64;

/** The field that a sheet chooses: a month, or the week of the peak. */
type MonthField = 'from' | 'to' | 'peak';

const FIELDS: readonly MonthField[] = ['from', 'to', 'peak'];

/** The option of the peak without a month. */
const NO_MONTH = 'keiner';

const FIELD_TEXT: Readonly<Record<MonthField, TranslationKey>> = {
  from: 'common.from',
  to: 'common.to',
  peak: 'admin.season.peak',
};

/** A labelled field of the page: its month, or the text for none. */
interface MonthRow {
  readonly id: MonthField;
  readonly label: string;
  readonly value: string;
}

/** The season of a species: a curve, the first and the last month and the week with the most finds. */
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
  ],
  templateUrl: './section-season.component.html',
  styleUrl: './section-season.component.scss',
})
export class SectionSeasonComponent {
  private readonly i18n = inject(I18nService);
  private readonly history = inject(HistoryService);
  private readonly state = inject(SpeciesEditorStore);

  protected readonly slug = injectRouteParam('slug');
  protected readonly from = linkedSignal(() => this.state.species()?.periodStartMonth ?? FIRST_MONTH);
  protected readonly to = linkedSignal(() => this.state.species()?.periodEndMonth ?? LAST_MONTH);
  protected readonly peak = linkedSignal<number | null>(() => this.state.species()?.periodPeakWeek ?? null);
  /** A species from the catalogue can have a peak month without a week. */
  private readonly peakMonth = linkedSignal<number | null>(
    () => this.state.species()?.periodPeakMonth ?? null,
  );

  protected readonly curve = computed(() => {
    const month = this.peakMonth();
    const centre = this.peak() ?? (month === null ? null : startWeek(month) + 2);
    return curvePaths(seasonCurve(this.from(), this.to(), centre), CURVE_WIDTH, CURVE_HEIGHT);
  });
  protected readonly curveMonths = computed(() => CURVE_MONTHS.map((month) => this.shortMonth(month)));
  protected readonly curveSize = `0 0 ${String(CURVE_WIDTH)} ${String(CURVE_HEIGHT)}`;
  protected readonly picking = signal<MonthField | null>(null);

  protected readonly fields = computed<MonthRow[]>(() =>
    FIELDS.map((id) => {
      return { id, label: this.i18n.translate(FIELD_TEXT[id]), value: this.valueText(id) };
    }),
  );

  protected readonly pickTitle = computed(() => {
    const field = this.picking();
    return field === null ? '' : this.i18n.translate(FIELD_TEXT[field]);
  });

  /** The peak is a week and is optional: its sheet starts with a row without a week. */
  protected readonly choices = computed<OptionSheetOption[]>(() => {
    if (this.picking() !== 'peak') {
      return MONTHS.map((month) => ({ id: String(month), title: this.monthName(month) }));
    }
    const weeks = CALENDAR_WEEKS.map((week) => ({ id: String(week), title: this.weekName(week) }));
    return [{ id: NO_MONTH, title: this.i18n.translate('common.none') }, ...weeks];
  });

  protected readonly picked = computed(() => {
    const field = this.picking();
    if (field === null) return null;
    const value = this.monthOf(field);
    return value === null ? NO_MONTH : String(value);
  });

  constructor() {
    this.state.load(this.slug);
  }

  protected choose(id: string): void {
    const month = id === NO_MONTH ? null : Number(id);
    const field = this.picking();
    if (field === 'from' && month !== null) this.from.set(month);
    if (field === 'to' && month !== null) this.to.set(month);
    if (field === 'peak') {
      this.peak.set(month);
      this.peakMonth.set(month === null ? null : monthOfWeek(month));
    }
    this.picking.set(null);
  }

  protected apply(): void {
    this.state.save({
      periodStartMonth: this.from(),
      periodEndMonth: this.to(),
      periodPeakMonth: this.peakMonth(),
      periodPeakWeek: this.peak(),
    });
    this.back();
  }

  /** Goes back to the page that opened this editor, for example the part page. */
  protected back(): void {
    this.history.back(['/verwaltung/arten', this.slug()]);
  }

  private monthOf(field: MonthField): number | null {
    if (field === 'from') return this.from();
    return field === 'to' ? this.to() : this.peak();
  }

  /** The peak shows its week. A peak from the catalogue without a week shows its month. */
  private valueText(field: MonthField): string {
    const week = field === 'peak' ? this.peak() : null;
    if (week !== null) return this.weekName(week);
    const month = field === 'peak' ? this.peakMonth() : this.monthOf(field);
    return month === null ? this.i18n.translate('common.none') : this.monthName(month);
  }

  private weekName(week: number): string {
    return this.i18n.translate('admin.season.week', { week });
  }

  /** The short month names of a chart axis have no dot, as on the board EditSeason. */
  private shortMonth(month: number): string {
    return this.i18n.translate(`enum.monthAxis.${String(month)}` as TranslationKey);
  }

  private monthName(month: number): string {
    return this.i18n.translate(`enum.month.${String(month)}` as TranslationKey);
  }
}

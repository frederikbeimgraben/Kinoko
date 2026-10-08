import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { TextEntry } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TextCatalogService } from '../../core/i18n/text-catalog.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '../../core/i18n/translations';
import { ViewportService } from '../../core/layout/viewport.service';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { LevelPillComponent } from '../../ui/level-pill/level-pill.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { SheetComponent } from '../../ui/sheet/sheet.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { ToastService } from '../../ui/toast/toast.service';

/** The filter value without an area: it shows each entry. */
const ALL = 'alle';

/** The filter value for the entries that differ from the default. */
const CHANGED = 'geaendert';

/** A key in the sheet, with the values that are in the fields now. */
interface Draft {
  key: string;
  values: Record<string, string>;
}

/** The interface texts: a search, a filter, both languages side by side and a sheet to change one.
 * The route needs `text.edit`. The backend also refuses each change without it. */
@Component({
  selector: 'app-texts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FormFieldComponent,
    LevelPillComponent,
    OverlayHostComponent,
    PageHeaderComponent,
    RowGroupSkeletonComponent,
    SearchFieldComponent,
    SegmentedComponent,
    SheetComponent,
    TranslatePipe,
  ],
  templateUrl: './texts.component.html',
  styleUrl: './texts.component.scss',
})
export class TextsComponent {
  private readonly catalog = inject(TextCatalogService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly locales = SUPPORTED_LOCALES;
  /** The default language comes first and in full colour. */
  protected readonly leadLocale = DEFAULT_LOCALE;
  protected readonly search = signal('');
  protected readonly scope = signal<string>(ALL);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly busy = signal(false);
  protected readonly loaded = computed(() => this.catalog.entries().length > 0);
  protected readonly wide = inject(ViewportService).wide;

  protected readonly scopes = computed<SegmentOption[]>(() => [
    { value: ALL, label: this.i18n.translate('admin.texts.all') },
    { value: CHANGED, label: this.i18n.translate('admin.texts.onlyChanged') },
  ]);

  protected readonly rows = computed<readonly TextEntry[]>(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const onlyChanged = this.scope() === CHANGED;
    return this.catalog
      .entries()
      .filter((entry) => !onlyChanged || entry.changed)
      .filter((entry) => matches(entry, query));
  });

  /** Only a changed text has a default to go back to. */
  protected readonly resettable = computed(() => this.entryOf(this.draft()?.key ?? '')?.changed ?? false);

  constructor() {
    // A deep link to this page can come before the first catalogue.
    if (this.catalog.entries().length === 0) void this.catalog.load();
  }

  protected localeLabel(locale: Locale): string {
    return this.i18n.translate(`sprache.${locale}`);
  }

  protected open(entry: TextEntry): void {
    this.draft.set({ key: entry.key, values: { ...entry.values } });
  }

  protected close(): void {
    this.draft.set(null);
  }

  protected edit(locale: Locale, value: string): void {
    const draft = this.draft();
    if (draft) this.draft.set({ ...draft, values: { ...draft.values, [locale]: value } });
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }

  /** Saves each changed language and closes the sheet. */
  protected async save(): Promise<void> {
    const draft = this.draft();
    const known = this.entryOf(draft?.key ?? '');
    if (!draft || !known) return;
    await this.run(async () => {
      for (const locale of this.locales) {
        const value = draft.values[locale];
        if (value !== known.values[locale]) await this.catalog.change(draft.key, locale, value);
      }
    });
  }

  protected async reset(): Promise<void> {
    const draft = this.draft();
    if (!draft) return;
    await this.run(async () => {
      for (const locale of this.locales) await this.catalog.reset(draft.key, locale);
    });
  }

  private async run(step: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await step();
      this.toasts.success(this.i18n.translate('texte.gespeichert'));
      this.draft.set(null);
    } catch {
      // The ApiClient shows the error. The sheet stays open, so the input stays.
    } finally {
      this.busy.set(false);
    }
  }

  private entryOf(key: string): TextEntry | undefined {
    return this.catalog.entries().find((entry) => entry.key === key);
  }
}

function matches(entry: TextEntry, query: string): boolean {
  if (query === '') return true;
  if (entry.key.toLocaleLowerCase().includes(query)) return true;
  return Object.values(entry.values).some((value) => value.toLocaleLowerCase().includes(query));
}

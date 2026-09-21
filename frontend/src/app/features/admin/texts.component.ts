import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { TextEntry } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TextCatalogService } from '../../core/i18n/text-catalog.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { LevelPillComponent } from '../../ui/level-pill/level-pill.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { SheetComponent } from '../../ui/sheet/sheet.component';
import { ToastService } from '../../ui/toast/toast.service';

/** Der Chip ohne Bereich: er zeigt alles. */
const ALL = 'alle';

/** Der Chip für die Einträge, die von der Vorgabe abweichen. */
const CHANGED = 'geaendert';

/** Das Blatt trägt zwei Felder und die Knöpfe; eine Raste genügt. */

/** Ein Schlüssel im Blatt, mit den Werten, die gerade im Feld stehen. */
interface Draft {
  key: string;
  values: Record<string, string>;
}

/**
 * Die Verwaltung der Oberflächentexte (Artboard `Texte`): Suche, Chips nach
 * Bereich, die Liste beider Sprachen nebeneinander und ein Blatt zum Ändern.
 *
 * Der Bereich eines Schlüssels steht in ihm selbst: `karte.legende` gehört zu
 * `karte`. Eine eigene Liste der Bereiche wäre eine zweite Wahrheit und beim
 * nächsten neuen Schlüssel schon veraltet.
 *
 * Die Route hängt am Recht `text.edit`. Sichtbar wird der Punkt nur damit;
 * abgelehnt wird jede Änderung ohnehin im Backend.
 */
@Component({
  selector: 'app-texts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FormFieldComponent,
    LevelPillComponent,
    OverlayHostComponent,
    PageHeaderComponent,
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
  /** Die Sprache der Vorgabe steht vorn und in voller Farbe. */
  protected readonly leadLocale = DEFAULT_LOCALE;
  protected readonly search = signal('');
  protected readonly scope = signal<string>(ALL);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly busy = signal(false);

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

  /** Nur ein geänderter Text hat eine Vorgabe, zu der er zurück kann. */
  protected readonly resettable = computed(() => this.entryOf(this.draft()?.key ?? '')?.changed ?? false);

  constructor() {
    // Ein tiefer Link auf diese Seite kommt vor dem ersten Katalog an.
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

  /** Speichert jede Sprache, die sich geändert hat, und schließt das Blatt. */
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
      // Der ApiClient hat den Fehler schon gezeigt. Das Blatt bleibt offen,
      // damit die Eingabe nicht verloren geht.
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

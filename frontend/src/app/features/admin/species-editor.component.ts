import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { shortDate } from '../../core/i18n/dates';
import { grouped } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { StatRowComponent, type Stat } from '../../ui/stat-row/stat-row.component';
import { SwitchComponent } from '../../ui/switch/switch.component';
import { SpeciesEditorState } from './species-editor.state';
import { featureRows, lookalikeRows, type EditorRow } from './species-editor.rows';

/** Ein Abschnitt des Editors mit seinen Zeilen. */
interface Block {
  title: string;
  rows: readonly EditorRow[];
  /** Ein Abschnitt, der wächst, trägt unten eine Zeile zum Anlegen. */
  add: string | null;
}

/** Die Art im Bearbeiten-Modus: Zahlen, Vorhersage, Abschnitte, Quelle. */
@Component({
  selector: 'app-species-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    AddRowComponent,
    ConfirmDialogComponent,
    ListRowComponent,
    PageHeaderComponent,
    StatRowComponent,
    SwitchComponent,
    TranslatePipe,
  ],
  templateUrl: './species-editor.component.html',
  styleUrl: './species-editor.component.scss',
})
export class SpeciesEditorComponent {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorState);

  private readonly slug = toSignal(this.route.paramMap.pipe(map((one) => one.get('slug') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('slug') ?? '',
  });

  protected readonly species = this.state.species;
  protected readonly forecast = this.state.forecast;
  protected readonly removing = signal(false);

  protected readonly title = computed(() =>
    [this.species()?.name, this.i18n.translate('admin.species.editTitle')].filter(Boolean).join(' '),
  );

  protected readonly stats = computed<Stat[]>(() => {
    const counts = this.state.counts();
    if (counts === null) return [];
    return [
      { value: grouped(counts.records), label: this.i18n.translate('admin.species.field.dataPoints') },
      { value: grouped(counts.finds), label: this.i18n.translate('admin.species.column.finds') },
      { value: grouped(counts.photos), label: this.i18n.translate('admin.species.column.photos') },
    ];
  });

  protected readonly blocks = computed<Block[]>(() => {
    const one = this.species();
    if (one === null) return [];
    const text = (key: TranslationKey): string => this.i18n.translate(key);
    const to = this.i18n.translate('common.to');
    return [
      {
        title: text('admin.species.section.features'),
        rows: featureRows(one, text, to),
        add: null,
      },
      {
        title: text('admin.species.section.texts'),
        rows: [
          {
            key: 'description',
            title: text('admin.species.field.shortDescription'),
            value: one.description ?? '',
          },
          {
            key: 'edibilityNote',
            title: text('admin.species.field.edibilityNote'),
            value: one.edibilityNote ?? '',
          },
        ],
        add: null,
      },
      {
        title: text('admin.species.section.lookalikes'),
        rows: lookalikeRows(one),
        add: text('admin.species.lookalike'),
      },
    ].filter((block) => block.rows.length > 0 || block.add !== null);
  });

  /** Woher die Merkmale stammen und wann jemand sie zuletzt angefasst hat. */
  protected readonly sourceText = computed(() => {
    const one = this.species();
    const source = one?.sources[0];
    if (one === null || source === undefined) return '';
    return this.i18n.translate('admin.species.sourceLine', {
      quelle: source.title,
      geprueft: this.day(source.checkedOn),
      wer: one.updatedByName ?? '',
      geaendert: this.day(one.updatedAt.slice(0, 10)),
    });
  });

  protected readonly deleteQuestion = computed(
    () => `${this.species()?.name ?? ''} ${this.i18n.translate('admin.species.deleteConfirmSuffix')}`,
  );

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug !== '') this.state.load(slug);
    });
  }

  protected setForecast(enabled: boolean): void {
    this.state.setForecast(enabled);
  }

  protected remove(): void {
    this.removing.set(false);
    this.state.remove();
    this.back();
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung/arten');
  }

  private day(value: string): string {
    return shortDate(value, this.i18n.locale(), (key, values) =>
      this.i18n.translate(key as TranslationKey, values),
    );
  }
}

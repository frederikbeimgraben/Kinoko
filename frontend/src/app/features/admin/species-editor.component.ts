import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { BodyPart } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { shortDate } from '../../core/i18n/dates';
import { injectRouteParam } from '../../core/navigation/route-param';
import { grouped, joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { StatRowComponent, type Stat } from '../../ui/stat-row/stat-row.component';
import { SwitchComponent } from '../../ui/switch/switch.component';
import { PartPickerComponent } from './part-picker.component';
import { SpeciesEditorState } from './species-editor.state';
import { featureRows, lookalikeRows, sourceRows, type EditorRow } from './species-editor.rows';
import { lookalikeWrites } from './species-lists';

/** Wohin ein Abschnitt führt: auf ein Teil, einen Text, eine Verwechslung, eine Quelle. */
type BlockKind = 'part' | 'text' | 'lookalike' | 'source';

/** Ein Abschnitt des Editors mit seinen Zeilen. */
interface Block {
  kind: BlockKind;
  title: string;
  rows: readonly EditorRow[];
  /** Ein Abschnitt, der wächst, trägt unten eine Zeile zum Anlegen. */
  add: string | null;
  addAction: string | null;
  /** Eine Zeile, die auf eine Unterseite führt, ist ein Knopf. */
  opens: boolean;
}

/** Die Art im Bearbeiten-Modus: Zahlen, Vorhersage, Abschnitte, Quelle. */
@Component({
  selector: 'app-species-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    AddRowComponent,
    ConfirmDialogComponent,
    PartPickerComponent,
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
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorState);

  private readonly slug = injectRouteParam('slug');

  protected readonly species = this.state.species;
  protected readonly forecast = this.state.forecast;
  protected readonly removing = signal(false);
  protected readonly picking = signal(false);
  protected readonly extraParts = this.state.extraParts;

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
    const blocks: Block[] = [
      {
        kind: 'part',
        title: text('admin.species.section.features'),
        rows: featureRows(one, this.state.extraParts(), text, to),
        add: text('admin.characteristic.part'),
        addAction: text('admin.species.addPart'),
        opens: true,
      },
      {
        kind: 'text',
        opens: false,
        addAction: null,
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
        kind: 'lookalike',
        title: text('admin.species.section.lookalikes'),
        rows: lookalikeRows(one),
        add: text('admin.species.lookalike'),
        addAction: text('admin.species.addLookalike'),
        opens: true,
      },
      {
        kind: 'source',
        title: text('admin.species.section.sources'),
        rows: sourceRows(one),
        add: text('admin.source.title'),
        addAction: text('admin.species.addSource'),
        opens: true,
      },
    ];
    return blocks.filter((block) => block.rows.length > 0 || block.add !== null);
  });

  /** Wer die Art zuletzt angefasst hat und wann. */
  protected readonly sourceText = computed(() => {
    const one = this.species();
    if (one === null) return '';
    return this.i18n.translate('admin.species.sourceLine', {
      wer: one.updatedByName ?? '',
      geaendert: this.day(one.updatedAt.slice(0, 10)),
    });
  });

  protected readonly deleteQuestion = computed(
    () => `${this.species()?.name ?? ''} ${this.i18n.translate('admin.species.deleteConfirmSuffix')}`,
  );

  /** Was der Löschung im Weg steht: Funde und eine gerechnete Karte. */
  protected readonly deleteMeta = computed(() => {
    const finds = this.state.counts()?.finds ?? 0;
    return joined([
      finds === 0 ? null : this.i18n.translate('admin.species.deleteFinds', { zahl: grouped(finds) }),
      this.forecast() ? this.i18n.translate('admin.species.deleteMap') : null,
    ]);
  });

  protected readonly deleteBlocked = computed(() => (this.state.counts()?.finds ?? 0) > 0);

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug !== '') this.state.load(slug);
    });
  }

  /** Eine Zeile führt auf die Unterseite ihres Abschnitts. */
  protected openRow(kind: BlockKind, at: number, key: string): void {
    if (kind === 'part') void this.router.navigate(['/verwaltung/arten', this.slug(), 'teil', key]);
    if (kind === 'lookalike') this.open('verwechslung', at);
    if (kind === 'source') this.open('quelle', at);
  }

  /** Die Zeile am Ende eines Abschnitts legt einen weiteren Eintrag an. */
  protected addRow(kind: BlockKind): void {
    if (kind === 'part') this.picking.set(true);
    if (kind === 'lookalike') this.open('verwechslung', lookalikeWrites(this.species()).length);
    if (kind === 'source') this.open('quelle', this.species()?.sources.length ?? 0);
  }

  /** Nimmt die gewählten Teile in die Art auf und schließt das Blatt. */
  protected addParts(parts: readonly BodyPart[]): void {
    this.state.addParts(parts);
    this.picking.set(false);
  }

  private open(step: string, at: number): void {
    void this.router.navigate(['/verwaltung/arten', this.slug(), step, at]);
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
    return shortDate(value, this.i18n);
  }
}

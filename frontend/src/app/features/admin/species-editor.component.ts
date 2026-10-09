import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { BodyPart, SpeciesEntry } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { shortDate } from '../../core/i18n/dates';
import { injectRouteParam } from '../../core/navigation/route-param';
import { grouped, joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { StatRowComponent, type Stat } from '../../ui/stat-row/stat-row.component';
import { SwitchComponent } from '../../ui/switch/switch.component';
import { PartPickerComponent } from './part-picker.component';
import { SpeciesEditorStore } from './species-editor.store';
import {
  changeRows,
  featureRows,
  lookalikeRows,
  moreRows,
  sourceRows,
  type EditorRow,
  type RowText,
} from './species-editor.rows';
import { heldParts, lookalikeWrites } from './species-lists';
import { termLabel } from './term-label';

/** The route step of each row in the section of the other features. */
const MORE_STEP: Readonly<Record<string, readonly string[]>> = {
  zeitraum: ['zeitraum'],
  fruchtschicht: ['fruchtschicht'],
  sinne: ['sinne', 'geruch'],
};

/** The species in edit mode: counts, forecast, texts, sections and source. */
@Component({
  selector: 'app-species-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    AddRowComponent,
    ConfirmDialogComponent,
    FormFieldComponent,
    PartPickerComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SectionComponent,
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
  private readonly state = inject(SpeciesEditorStore);

  private readonly slug = injectRouteParam('slug');

  protected readonly species = this.state.species;
  protected readonly forecast = this.state.forecast;
  protected readonly removing = signal(false);
  protected readonly picking = signal(false);
  protected readonly extraParts = this.state.extraParts;

  protected readonly description = linkedSignal(() => this.species()?.description ?? '');
  protected readonly edibilityNote = linkedSignal(() => this.species()?.edibilityNote ?? '');

  protected readonly title = computed(() => {
    const name = this.species()?.name;
    return name === undefined ? '' : this.i18n.translate('admin.species.editName', { name });
  });

  protected readonly stats = computed<Stat[]>(() => {
    const counts = this.state.counts();
    if (counts === null) return [];
    return [
      { value: grouped(counts.records), label: this.i18n.translate('admin.species.field.dataPoints') },
      { value: grouped(counts.finds), label: this.i18n.translate('admin.species.column.finds') },
      { value: grouped(counts.photos), label: this.i18n.translate('admin.species.column.photos') },
    ];
  });

  private readonly rowText = computed<RowText>(() => ({
    text: (key, values) => this.i18n.translate(key, values),
    locale: this.i18n.locale(),
    term: (term) => termLabel(term, this.i18n),
  }));

  private rows(build: (species: SpeciesEntry) => EditorRow[]): EditorRow[] {
    const one = this.species();
    return one === null ? [] : build(one);
  }

  protected readonly features = computed(() =>
    this.rows((one) => featureRows(one, this.extraParts(), this.rowText())),
  );
  protected readonly changes = computed(() => this.rows((one) => changeRows(one, this.rowText())));
  protected readonly more = computed(() => this.rows((one) => moreRows(one, this.rowText())));
  protected readonly lookalikes = computed(() => this.rows(lookalikeRows));
  protected readonly sources = computed(() => this.rows(sourceRows));

  /** The person who changed the species last, and the day of the change. */
  protected readonly sourceText = computed(() => {
    const one = this.species();
    if (one === null) return '';
    const day = shortDate(one.updatedAt.slice(0, 10), this.i18n);
    const name = one.updatedByName ?? '';
    return name === ''
      ? this.i18n.translate('admin.species.changedOn', { geaendert: day })
      : this.i18n.translate('admin.species.sourceLine', { wer: name, geaendert: day });
  });

  protected readonly deleteQuestion = computed(() =>
    this.i18n.translate('admin.species.deleteQuestion', { name: this.species()?.name ?? '' }),
  );

  /** The items that block the deletion: finds and a computed map. */
  protected readonly deleteMeta = computed(() => {
    const finds = this.state.counts()?.finds ?? 0;
    return joined([
      finds === 0 ? null : this.i18n.translate('admin.species.deleteFinds', { zahl: grouped(finds) }),
      this.forecast() ? this.i18n.translate('admin.species.deleteMap') : null,
    ]);
  });

  protected readonly deleteBlocked = computed(() => (this.state.counts()?.finds ?? 0) > 0);

  constructor() {
    this.state.load(this.slug);
  }

  protected openPart(key: string): void {
    this.open(['teil', key]);
  }

  protected openChange(at: number): void {
    const change = this.species()?.colourChanges[at];
    if (change !== undefined) this.open(['verfaerbung', change.part, String(at)]);
  }

  /** A new colour change starts on the first part of the species. */
  protected addChange(): void {
    const part: BodyPart = heldParts(this.species())[0] ?? 'cap';
    this.open(['verfaerbung', part, String(this.species()?.colourChanges.length ?? 0)]);
  }

  protected openMore(key: string): void {
    this.open(MORE_STEP[key] ?? []);
  }

  protected openLookalike(at: number): void {
    this.open(['verwechslung', String(at)]);
  }

  protected addLookalike(): void {
    this.openLookalike(lookalikeWrites(this.species()).length);
  }

  protected openSource(at: number): void {
    this.open(['quelle', String(at)]);
  }

  protected addSource(): void {
    this.openSource(this.species()?.sources.length ?? 0);
  }

  /** Adds the chosen parts to the species and closes the sheet. */
  protected addParts(parts: readonly BodyPart[]): void {
    this.state.addParts(parts);
    this.picking.set(false);
  }

  private open(steps: readonly string[]): void {
    void this.router.navigate(['/verwaltung/arten', this.slug(), ...steps]);
  }

  protected setForecast(enabled: boolean): void {
    this.state.setForecast(enabled);
  }

  /** Writes the texts of the page. The subpages write their own fields. */
  protected save(): void {
    const text = (value: string): string | null => (value.trim() === '' ? null : value);
    this.state.save({ description: text(this.description()), edibilityNote: text(this.edibilityNote()) });
    this.back();
  }

  protected remove(): void {
    this.removing.set(false);
    this.state.remove({
      onDone: () => {
        this.back();
      },
    });
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung/arten');
  }
}

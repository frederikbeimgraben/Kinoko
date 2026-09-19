import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { BodyPart, Measurement } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { ColourFieldComponent } from '../../ui/colour-field/colour-field.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { DIMENSION_TEXT, PART_TEXT } from '../species/labels';
import { SpeciesEditorState } from './species-editor.state';
import { changeRows, colourRows, sizeRows, type ColourRow, type SizeRow } from './section-part.rows';
import { changes, withPartNote, withoutPart } from './species-lists';

/** Ein Teil einer Art: seine Maße, seine Farben und seine Verfärbungen. */
@Component({
  selector: 'app-section-part',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    AddRowComponent,
    ColourFieldComponent,
    FormFieldComponent,
    ListRowComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './section-part.component.html',
  styleUrl: './section-part.component.scss',
})
export class SectionPartComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorState);

  protected readonly slug = injectRouteParam('slug');
  private readonly partParam = injectRouteParam('part', 'cap');
  protected readonly part = computed(() => this.partParam() as BodyPart);

  protected readonly title = computed(() => this.i18n.translate(PART_TEXT[this.part()]));

  protected readonly sizes = computed<SizeRow[]>(() =>
    sizeRows(this.state.species(), this.part(), DIMENSION_TEXT, (one) => this.span(one)),
  );

  protected readonly colours = computed<ColourRow[]>(() =>
    colourRows(this.state.species(), this.part(), this.i18n.translate('common.colour')),
  );

  protected readonly changes = computed<ColourRow[]>(() => changeRows(this.state.species(), this.part()));

  protected readonly description = signal('');
  protected readonly comment = signal('');

  private readonly note = computed(
    () => this.state.species()?.partNotes?.find((one) => one.part === this.part()) ?? null,
  );

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug !== '') this.state.load(slug);
    });
    effect(() => {
      const note = this.note();
      this.description.set(note?.description ?? '');
      this.comment.set(note?.comment ?? '');
    });
  }

  protected openSize(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug(), 'mass', this.part()]);
  }

  protected openColour(at: number): void {
    void this.router.navigate(['/verwaltung/arten', this.slug(), 'farbe', this.part(), at]);
  }

  protected addColour(): void {
    this.openColour(this.colours().length);
  }

  protected openChange(at: number): void {
    void this.router.navigate(['/verwaltung/arten', this.slug(), 'verfaerbung', this.part(), at]);
  }

  protected addChange(): void {
    this.openChange(changes(this.state.species()).length);
  }

  protected apply(): void {
    this.state.save({
      partNotes: withPartNote(this.state.species(), {
        part: this.part(),
        description: this.description(),
        comment: this.comment(),
      }),
    });
    this.back();
  }

  protected remove(): void {
    this.state.save(withoutPart(this.state.species(), this.part()));
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  /** Eine Spanne liest sich wie im Editor: zwei Zahlen und die Einheit. */
  private span(one: Measurement): string {
    return `${one.low} ${this.i18n.translate('common.to')} ${one.high} ${one.unit}`;
  }
}

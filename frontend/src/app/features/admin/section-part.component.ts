import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { BodyPart, Measurement } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { ColourFieldComponent } from '../../ui/colour-field/colour-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { DIMENSION_TEXT, PART_TEXT } from '../species/labels';
import { SpeciesEditorState } from './species-editor.state';
import { changeRows, colourRows, sizeRows, type ColourRow, type SizeRow } from './section-part.rows';
import { withoutPart } from './species-lists';

/** Ein Teil einer Art: seine Maße, seine Farben und seine Verfärbungen. */
@Component({
  selector: 'app-section-part',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    AddRowComponent,
    ColourFieldComponent,
    ListRowComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './section-part.component.html',
  styleUrl: './section-part.component.scss',
})
export class SectionPartComponent {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorState);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly slug = computed(() => this.params().get('slug') ?? '');
  protected readonly part = computed(() => (this.params().get('part') ?? 'cap') as BodyPart);

  protected readonly title = computed(() => this.i18n.translate(PART_TEXT[this.part()]));

  protected readonly sizes = computed<SizeRow[]>(() =>
    sizeRows(this.state.species(), this.part(), DIMENSION_TEXT, (one) => this.span(one)),
  );

  protected readonly colours = computed<ColourRow[]>(() =>
    colourRows(this.state.species(), this.part(), this.i18n.translate('common.colour')),
  );

  protected readonly changes = computed<ColourRow[]>(() => changeRows(this.state.species(), this.part()));

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug !== '') this.state.load(slug);
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
    this.openChange(this.state.species()?.colourChanges.length ?? 0);
  }

  protected apply(): void {
    this.back();
  }

  protected remove(): void {
    const species = this.state.species();
    if (species === null) return;
    this.state.save(withoutPart(species, this.part()));
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

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { BodyPart, ColourMode, ColourValue } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ColourFieldComponent } from '../../ui/colour-field/colour-field.component';
import {
  ColourPickerComponent,
  type ColourPickerSwatch,
} from '../../ui/colour-picker/colour-picker.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { PART_TEXT } from '../species/labels';
import { CatalogueState } from './catalogue.state';
import { SpeciesEditorState } from './species-editor.state';
import { COLOUR_MODES, fieldMode, trimmed, withColour } from './section-colour.rows';
import { colourGroupAt, withColourGroup, withoutColourGroup } from './species-lists';

const MODE_TEXT = {
  single: 'enum.colour_mode.single',
  gradient: 'enum.colour_mode.gradient',
  distinct: 'enum.colour_mode.multiple',
} as const;

/** Ein Farbwert mit seiner Stelle in der Gruppe. */
interface Stop {
  at: number;
  hex: string;
  name: string;
}

/** Die Farbe eines Teils: Art des Werts, die Werte und der offene Wert. */
@Component({
  selector: 'app-section-colour',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ColourFieldComponent,
    ColourPickerComponent,
    FormFieldComponent,
    ListRowComponent,
    PageHeaderComponent,
    SegmentedComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './section-colour.component.html',
  styleUrl: './section-colour.component.scss',
})
export class SectionColourComponent {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorState);
  private readonly catalogue = inject(CatalogueState);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly slug = computed(() => this.params().get('slug') ?? '');
  protected readonly part = computed(() => (this.params().get('part') ?? 'cap') as BodyPart);
  protected readonly at = computed(() => Number(this.params().get('index') ?? '0'));

  protected readonly mode = signal<ColourMode>('single');
  protected readonly colours = signal<ColourValue[]>([]);
  protected readonly open = signal(0);

  protected readonly title = computed(() =>
    this.i18n.translate('admin.colour.title', { teil: this.i18n.translate(PART_TEXT[this.part()]) }),
  );

  protected readonly choices = computed<SegmentOption[]>(() =>
    COLOUR_MODES.map((one) => ({ value: one, label: this.i18n.translate(MODE_TEXT[one]) })),
  );

  protected readonly stops = computed<Stop[]>(() =>
    this.colours().map((one, at) => ({ at, hex: one.hex.toUpperCase(), name: one.name })),
  );

  protected readonly modeName = computed(() => this.i18n.translate(MODE_TEXT[this.mode()]));

  protected readonly stripMode = computed(() => fieldMode(this.mode()));

  protected readonly openTitle = computed(() =>
    this.i18n.translate('admin.colour.section.stop', { nummer: this.open() + 1 }),
  );

  protected readonly swatches = computed<ColourPickerSwatch[]>(() =>
    this.catalogue.standardColours().map((one) => ({ value: one.hex, label: one.key })),
  );

  protected readonly chosen = computed(() => this.colours()[this.open()]?.hex ?? '');
  protected readonly chosenName = computed(() => this.colours()[this.open()]?.name ?? '');
  protected readonly chosenHex = computed(() => this.chosen().toUpperCase());
  protected readonly chosenAsList = computed<ColourValue[]>(() =>
    this.colours().filter((_, at) => at === this.open()),
  );

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug !== '') this.state.load(slug);
    });
    this.catalogue.load();
    effect(() => {
      const group = colourGroupAt(this.state.species(), this.part(), this.at());
      this.mode.set(group === null ? 'single' : group.mode);
      this.colours.set(group === null ? [] : [...group.colours]);
      this.open.set(0);
    });
  }

  protected chooseMode(value: string): void {
    const mode = value as ColourMode;
    this.mode.set(mode);
    this.colours.update((colours) => trimmed(colours, mode));
    this.open.set(0);
  }

  protected chooseHex(hex: string): void {
    this.setColour({ hex, name: this.chosenName() });
  }

  protected setName(name: string): void {
    this.setColour({ hex: this.chosen(), name });
  }

  protected openStop(at: number): void {
    this.open.set(at);
  }

  protected addStop(): void {
    this.colours.update((colours) => [...colours, { hex: '#b08a5a', name: '' }]);
    this.open.set(this.colours().length - 1);
  }

  protected removeStop(at: number): void {
    this.colours.update((colours) => colours.filter((_, index) => index !== at));
    this.open.set(0);
  }

  protected apply(): void {
    const group = { part: this.part(), mode: this.mode(), colours: this.colours() };
    this.state.save({ colours: withColourGroup(this.state.species(), this.part(), this.at(), group) });
    this.back();
  }

  protected remove(): void {
    this.state.save({ colours: withoutColourGroup(this.state.species(), this.part(), this.at()) });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  private setColour(colour: ColourValue): void {
    this.colours.update((colours) => withColour(colours, this.open(), colour));
  }
}

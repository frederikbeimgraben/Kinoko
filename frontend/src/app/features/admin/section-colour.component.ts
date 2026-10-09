import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import type { BodyPart, ColourMode, ColourValue } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import {
  ColourPickerComponent,
  type ColourPickerSwatch,
} from '../../ui/colour-picker/colour-picker.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { PART_TEXT } from '../species/labels';
import { CatalogueStore } from './catalogue.store';
import { injectColourLabel, toneName } from './colour-label';
import { SpeciesEditorStore } from './species-editor.store';
import { COLOUR_MODES, stopText, trimmed, withColour } from './section-colour.rows';
import { colourGroupAt, isBodyPart, withColourGroup, withoutColourGroup } from './species-lists';

const MODE_TEXT = {
  single: 'enum.colour_mode.single',
  gradient: 'enum.colour_mode.gradient',
  distinct: 'enum.colour_mode.multiple',
} as const;

/** A colour value with its position in the group and the text below its name. */
interface Stop {
  at: number;
  hex: string;
  name: string;
  note: string;
}

/** The colour of a part: the mode, the values and the open value. */
@Component({
  selector: 'app-section-colour',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    AddRowComponent,
    ColourPickerComponent,
    FormFieldComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    SectionComponent,
    SegmentedComponent,
    StateViewComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './section-colour.component.html',
  styleUrl: './section-colour.component.scss',
})
export class SectionColourComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorStore);
  private readonly catalogue = inject(CatalogueStore);
  private readonly colourLabel = injectColourLabel();

  protected readonly slug = injectRouteParam('slug');
  private readonly partParam = injectRouteParam('part', 'cap');
  /** A route with an unknown part, for example `hut`, shows the not-found state. */
  protected readonly part = computed<BodyPart | null>(() => {
    const value = this.partParam();
    return isBodyPart(value) ? value : null;
  });
  private readonly index = injectRouteParam('index', '0');
  protected readonly at = computed(() => Number(this.index()));

  private readonly group = computed(() => {
    const part = this.part();
    return part === null ? null : colourGroupAt(this.state.species(), part, this.at());
  });
  /** Only a stored colour can be removed. A new one has nothing to remove. */
  protected readonly known = computed(() => this.group() !== null);

  protected readonly mode = linkedSignal<ColourMode>(() => this.group()?.mode ?? 'single');
  protected readonly colours = linkedSignal<ColourValue[]>(() => [...(this.group()?.colours ?? [])]);
  protected readonly open = linkedSignal({ source: this.group, computation: () => 0 });

  protected readonly title = computed(() => {
    const part = this.part();
    return part === null
      ? this.i18n.translate('error.notFound')
      : this.i18n.translate('admin.colour.title', { teil: this.i18n.translate(PART_TEXT[part]) });
  });

  protected readonly choices = computed<SegmentOption[]>(() =>
    COLOUR_MODES.map((one) => ({ value: one, label: this.i18n.translate(MODE_TEXT[one]) })),
  );

  protected readonly stops = computed<Stop[]>(() => {
    const colours = this.colours();
    return colours.map((one, at) => ({
      at,
      hex: one.hex,
      name: one.name === '' ? one.hex.toUpperCase() : this.colourLabel(one),
      note: stopText(this.mode(), at, colours.length, one.hex, (key: TranslationKey) =>
        this.i18n.translate(key),
      ),
    }));
  });

  protected readonly modeName = computed(() => this.i18n.translate(MODE_TEXT[this.mode()]));

  /** A single colour has no add row. */
  protected readonly addable = computed(() => this.mode() !== 'single' || this.colours().length === 0);

  /** The standard tones with their names in the UI language. */
  protected readonly swatches = computed<ColourPickerSwatch[]>(() =>
    this.catalogue.standardColours().map((one) => ({
      value: one.hex,
      label: this.i18n.translate(`enum.colour.${one.key}` as TranslationKey),
    })),
  );

  protected readonly chosen = computed(() => this.colours()[this.open()]?.hex ?? '');
  protected readonly chosenName = computed(() => this.colours()[this.open()]?.name ?? '');

  constructor() {
    this.state.load(this.slug);
    this.catalogue.load();
  }

  protected chooseMode(value: string): void {
    const mode = value as ColourMode;
    this.mode.set(mode);
    this.colours.update((colours) => trimmed(colours, mode));
    this.open.set(0);
  }

  /** A tone gives its name to the colour. The name field can change it after. */
  protected chooseHex(hex: string): void {
    this.setColour({ hex, name: this.storedName(hex) ?? this.chosenName() });
  }

  /** The catalogue keeps German names, also when the editor works in English. */
  private storedName(hex: string): string | null {
    return toneName(hex, this.catalogue.standardColours(), this.i18n);
  }

  protected setName(name: string): void {
    this.setColour({ hex: this.chosen(), name });
  }

  protected openStop(at: number): void {
    this.open.set(at);
  }

  /** A new colour starts as the first standard tone. */
  protected addStop(): void {
    const hex = this.swatches()[0]?.value ?? '#b08a5a';
    this.colours.update((colours) => [...colours, { hex, name: this.storedName(hex) ?? '' }]);
    this.open.set(this.colours().length - 1);
  }

  protected removeStop(at: number): void {
    this.colours.update((colours) => colours.filter((_, index) => index !== at));
    this.open.set(0);
  }

  protected apply(): void {
    const part = this.part();
    if (part === null || this.colours().length === 0) return;
    const group = { part, mode: this.mode(), colours: this.colours() };
    this.state.save({ colours: withColourGroup(this.state.species(), part, this.at(), group) });
    this.back();
  }

  protected remove(): void {
    const part = this.part();
    if (part === null) return;
    this.state.save({ colours: withoutColourGroup(this.state.species(), part, this.at()) });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  private setColour(colour: ColourValue): void {
    this.colours.update((colours) => withColour(colours, this.open(), colour));
  }
}

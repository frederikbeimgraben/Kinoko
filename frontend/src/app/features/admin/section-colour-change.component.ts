import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import type {
  BodyPart,
  ColourChange,
  ColourValue,
  Speed,
  TermRef,
  TriggerGroup,
} from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import {
  ColourPickerComponent,
  type ColourPickerSwatch,
} from '../../ui/colour-picker/colour-picker.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OptionSheetComponent, type OptionSheetOption } from '../../ui/option-sheet/option-sheet.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { PART_TEXT, SPEED_TEXT } from '../species/labels';
import { CatalogueStore } from './catalogue.store';
import { TermsStore } from './terms.store';
import { SpeciesEditorStore } from './species-editor.store';
import { SPEEDS, TRIGGER_GROUPS, TRIGGER_GROUP_TEXT, changeAt } from './section-colour-change.rows';
import { PART_ORDER, isBodyPart, withChange, withoutChange } from './species-lists';
import { termLabel } from './term-label';

/** The two colours of a change: the colour before and the colour after. */
type End = 'from' | 'to';

/** A colour change: the part, the triggers, two colours and the speed. A new index makes a new change. */
@Component({
  selector: 'app-section-colour-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ChipGroupComponent,
    ColourPickerComponent,
    ListRowComponent,
    OptionSheetComponent,
    PageHeaderComponent,
    RowGroupComponent,
    SectionComponent,
    SegmentedComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './section-colour-change.component.html',
  styleUrl: './section-colour-change.component.scss',
})
export class SectionColourChangeComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorStore);
  private readonly terms = inject(TermsStore);
  private readonly catalogue = inject(CatalogueStore);

  protected readonly slug = injectRouteParam('slug');
  private readonly partParam = injectRouteParam('part', 'cap');
  private readonly index = injectRouteParam('index', '0');
  protected readonly at = computed(() => Number(this.index()));

  /** A route with an unknown part, for example `hut`, shows the not-found state. */
  protected readonly known = computed(() => isBodyPart(this.partParam()));

  private readonly change = computed<ColourChange | null>(() => changeAt(this.state.species(), this.at()));
  /** A change that the species does not have yet. */
  protected readonly isNew = computed(() => this.state.species() !== null && this.change() === null);

  protected readonly part = linkedSignal<BodyPart>(() => {
    const value = this.partParam();
    return this.change()?.part ?? (isBodyPart(value) ? value : 'cap');
  });
  protected readonly kind = linkedSignal<TriggerGroup>(() => this.change()?.kind ?? 'mechanical');
  protected readonly triggers = linkedSignal<readonly string[]>(
    () => this.change()?.triggers.map((one) => one.id) ?? [],
  );
  protected readonly speed = linkedSignal<Speed | null>(() => this.change()?.speed ?? null);
  protected readonly from = linkedSignal<ColourValue | null>(() => this.change()?.from ?? null);
  protected readonly to = linkedSignal<ColourValue | null>(() => this.change()?.to ?? null);
  protected readonly openEnd = linkedSignal<ColourChange | null, End>({
    source: this.change,
    computation: () => 'to',
  });
  protected readonly picking = signal(false);

  protected readonly partName = computed(() => this.i18n.translate(PART_TEXT[this.part()]));

  protected readonly parts = computed<OptionSheetOption[]>(() =>
    PART_ORDER.map((one) => ({ id: one, title: this.i18n.translate(PART_TEXT[one]) })),
  );

  protected readonly kinds = computed<SegmentOption[]>(() =>
    TRIGGER_GROUPS.map((one) => ({ value: one, label: this.i18n.translate(TRIGGER_GROUP_TEXT[one]) })),
  );

  /** Only the triggers of the chosen group. A trigger without a group shows in each group. */
  protected readonly triggerChips = computed<Chip[]>(() =>
    this.terms
      .forKind('trigger')
      .filter((term) => (term.group ?? this.kind()) === this.kind())
      .map((term) => ({ value: term.id, label: termLabel(term, this.i18n) })),
  );

  protected readonly speedChips = computed<Chip[]>(() =>
    SPEEDS.map((one) => ({ value: one, label: this.i18n.translate(SPEED_TEXT[one]) })),
  );

  protected readonly speedValue = computed<string[]>(() => {
    const held = this.speed();
    return held === null ? [] : [held];
  });

  /** The standard tones with their names in the UI language. */
  protected readonly swatches = computed<ColourPickerSwatch[]>(() =>
    this.catalogue.standardColours().map((one) => ({
      value: one.hex,
      label: this.i18n.translate(`enum.colour.${one.key}` as TranslationKey),
    })),
  );

  protected readonly openHex = computed(
    () => (this.openEnd() === 'from' ? this.from() : this.to())?.hex ?? '',
  );

  /** A change needs a trigger and the colour after. */
  protected readonly complete = computed(() => this.to() !== null && this.triggers().length > 0);

  constructor() {
    this.state.load(this.slug);
    this.terms.load();
    this.catalogue.load();
  }

  protected choosePart(value: string): void {
    if (isBodyPart(value)) this.part.set(value);
    this.picking.set(false);
  }

  /** A new group keeps only the triggers that belong to it. */
  protected chooseKind(value: string): void {
    const kind = value as TriggerGroup;
    this.kind.set(kind);
    const allowed = new Set(this.triggerChips().map((one) => one.value));
    this.triggers.update((held) => held.filter((id) => allowed.has(id)));
  }

  protected chooseSpeed(values: readonly string[]): void {
    this.speed.set((values[0] ?? null) as Speed | null);
  }

  protected chooseHex(hex: string): void {
    const tone = this.swatches().find((one) => one.value === hex);
    const colour: ColourValue = { hex, name: tone?.label ?? hex };
    if (this.openEnd() === 'from') this.from.set(colour);
    else this.to.set(colour);
  }

  protected apply(): void {
    const species = this.state.species();
    const to = this.to();
    if (species === null || to === null || !this.complete()) return;
    const known = this.change()?.triggers ?? [];
    const next: ColourChange = {
      part: this.part(),
      kind: this.kind(),
      from: this.from(),
      to,
      speed: this.speed(),
      triggers: this.triggers().map((id) => this.termById(id, known)),
    };
    this.state.save({ colourChanges: withChange(species, this.at(), next) });
    this.back();
  }

  protected remove(): void {
    this.state.save({ colourChanges: withoutChange(this.state.species(), this.at()) });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  private termById(id: string, known: readonly TermRef[]): TermRef {
    const held = known.find((one) => one.id === id);
    if (held !== undefined) return held;
    const term = this.terms.forKind('trigger').find((one) => one.id === id);
    return term ?? { id, kind: 'trigger', name: '', slug: '' };
  }
}

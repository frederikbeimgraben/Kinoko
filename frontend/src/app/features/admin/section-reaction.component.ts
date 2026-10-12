import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import {
  REACTION_RESULTS,
  type BodyPart,
  type ColourValue,
  type ReactionResult,
  type ReactionSource,
  type SpeciesReaction,
} from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { HistoryService } from '../../core/navigation/history.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { CheckRowComponent } from '../../ui/check-row/check-row.component';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import {
  ColourPickerComponent,
  type ColourPickerSwatch,
} from '../../ui/colour-picker/colour-picker.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { PART_TEXT } from '../species/labels';
import { CatalogueStore } from './catalogue.store';
import { injectColourLabel, toneName } from './colour-label';
import { TermsStore } from './terms.store';
import { SpeciesEditorStore } from './species-editor.store';
import { chosen } from './section-basics.rows';
import { cleanSources, reactionAt, withReaction, withoutReaction } from './section-reaction.rows';
import { PART_ORDER } from './species-lists';
import { termLabel } from './term-label';

const RESULT_TEXT: Readonly<Record<ReactionResult, TranslationKey>> = {
  positive: 'species.reaction.positive',
  negative: 'species.reaction.negative',
  variable: 'species.reaction.variable',
  unknown: 'species.reaction.unknown',
};

/** A field of a source row. */
type SourceField = keyof ReactionSource;

/** The reaction of a species to a reagent: reading, part, result, colour, flags and sources. */
@Component({
  selector: 'app-section-reaction',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    AddRowComponent,
    CheckRowComponent,
    ChipGroupComponent,
    ColourPickerComponent,
    FormFieldComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    SectionComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './section-reaction.component.html',
  styleUrl: './section-reaction.component.scss',
})
export class SectionReactionComponent {
  private readonly i18n = inject(I18nService);
  private readonly history = inject(HistoryService);
  private readonly state = inject(SpeciesEditorStore);
  private readonly terms = inject(TermsStore);
  private readonly catalogue = inject(CatalogueStore);
  private readonly colourLabel = injectColourLabel();

  protected readonly slug = injectRouteParam('slug');
  private readonly index = injectRouteParam('index', '0');
  private readonly at = computed(() => Number(this.index()));
  private readonly held = computed(() => reactionAt(this.state.species(), this.at()));
  /** Only a stored reaction can be removed. */
  protected readonly known = computed(() => this.held() !== null);

  protected readonly reagent = linkedSignal<SpeciesReaction['reagent'] | null>(
    () => this.held()?.reagent ?? null,
  );
  protected readonly reading = linkedSignal(() => this.held()?.reading ?? '');
  protected readonly result = linkedSignal<ReactionResult>(() => this.held()?.result ?? 'positive');
  protected readonly part = linkedSignal<BodyPart | null>(() => this.held()?.part ?? null);
  protected readonly location = linkedSignal(() => this.held()?.location ?? '');
  protected readonly colour = linkedSignal<ColourValue | null>(() => this.held()?.colour ?? null);
  protected readonly contested = linkedSignal(() => this.held()?.contested ?? false);
  protected readonly partlyConfirmed = linkedSignal(() => this.held()?.partlyConfirmed ?? false);
  protected readonly sources = linkedSignal<readonly ReactionSource[]>(() => this.held()?.sources ?? []);

  /** The reagents of the catalogue. A stored reagent of another trigger group stays a choice. */
  protected readonly reagents = computed<Chip[]>(() => {
    const triggers = this.terms.forKind('trigger');
    const held = this.held()?.reagent.slug;
    return triggers
      .filter((term) => term.group === 'reagent' || term.slug === held)
      .map((term) => ({ value: term.slug, label: termLabel(term, this.i18n) }));
  });
  protected readonly reagentValue = computed(() => chosen(this.reagent()?.slug));

  protected readonly results = computed<SegmentOption[]>(() =>
    REACTION_RESULTS.map((value) => ({ value, label: this.i18n.translate(RESULT_TEXT[value]) })),
  );

  protected readonly parts = computed<Chip[]>(() =>
    PART_ORDER.map((value) => ({ value, label: this.i18n.translate(PART_TEXT[value]) })),
  );
  protected readonly partValue = computed(() => chosen(this.part()));

  protected readonly swatches = computed<ColourPickerSwatch[]>(() =>
    this.catalogue.standardColours().map((one) => ({
      value: one.hex,
      label: this.i18n.translate(`enum.colour.${one.key}` as TranslationKey),
    })),
  );
  protected readonly colourName = computed(() => {
    const colour = this.colour();
    return colour === null ? this.i18n.translate('admin.reaction.noColour') : this.colourLabel(colour);
  });

  /** A reaction needs a reagent and its reading. */
  protected readonly complete = computed(() => this.reagent() !== null && this.reading().trim() !== '');

  constructor() {
    this.state.load(this.slug);
    this.terms.load();
    this.catalogue.load();
  }

  protected chooseReagent(values: readonly string[]): void {
    const term = this.terms.forKind('trigger').find((one) => one.slug === values[0]);
    this.reagent.set(term === undefined ? null : { slug: term.slug, name: term.name });
  }

  protected chooseResult(value: string): void {
    this.result.set(value as ReactionResult);
  }

  protected choosePart(values: readonly string[]): void {
    this.part.set((values[0] ?? null) as BodyPart | null);
  }

  /** The catalogue keeps German names, also when the editor works in English. */
  protected chooseHex(hex: string): void {
    this.colour.set({ hex, name: toneName(hex, this.catalogue.standardColours(), this.i18n) ?? hex });
  }

  protected writeSource(at: number, field: SourceField, value: string): void {
    this.sources.update((held) =>
      held.map((one, index) => (index === at ? { ...one, [field]: value } : one)),
    );
  }

  protected addSource(): void {
    this.sources.update((held) => [...held, { label: '', url: null, year: null }]);
  }

  protected removeSource(at: number): void {
    this.sources.update((held) => held.filter((_, index) => index !== at));
  }

  protected apply(): void {
    const reagent = this.reagent();
    if (reagent === null || !this.complete()) return;
    const location = this.location().trim();
    const colour = this.colour();
    this.state.save({
      reactions: withReaction(this.state.species(), this.at(), {
        reagent,
        reading: this.reading().trim(),
        part: this.part(),
        location: location === '' ? null : location,
        result: this.result(),
        colour: colour === null ? null : { name: colour.name, hex: colour.hex },
        contested: this.contested(),
        partlyConfirmed: this.partlyConfirmed(),
        sources: cleanSources(this.sources()),
      }),
    });
    this.back();
  }

  protected remove(): void {
    this.state.save({ reactions: withoutReaction(this.state.species(), this.at()) });
    this.back();
  }

  protected back(): void {
    this.history.back(['/verwaltung/arten', this.slug()]);
  }
}

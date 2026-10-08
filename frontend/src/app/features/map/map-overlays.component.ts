import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import type { Combination } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ViewportService } from '../../core/layout/viewport.service';
import { histogramFor, type Layer } from '../../core/tiles/layers';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SheetComponent, type Detent } from '../../ui/sheet/sheet.component';
import { CombinationsComponent } from './combinations.component';
import { FactorSheetComponent } from './factor-sheet.component';
import type { Factor } from './factors';
import { encodeFactors, fromWire } from './factors';
import { LayerPickComponent } from './layer-pick.component';
import { MapView } from './map.view';
import { SpeciesPickComponent } from './species-pick.component';

/** The sheet that is over the map. */
export type Overlay = 'species' | 'layer' | 'factors' | 'factor' | 'combinations' | 'save' | null;

/** The head of each sheet names its subject. The factor sheet names its source. */
const TITLE: Partial<Record<NonNullable<Overlay>, TranslationKey>> = {
  species: 'map.species.choose',
  layer: 'map.tab.layer',
  combinations: 'map.combination.list',
  save: 'map.combination.save',
};

/** A name needs little space. Each other sheet takes the full height. */
export function overlayDetent(open: Overlay): Detent {
  return open === 'save' ? 1 : 2;
}

/** The sheets over the map, per the boards `MapSpecies`, `MapLayerPicker`, `MapCombinations` and `MapCombinationSave`. */
@Component({
  selector: 'app-map-overlays',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CombinationsComponent,
    ConfirmDialogComponent,
    FactorSheetComponent,
    FormFieldComponent,
    LayerPickComponent,
    OverlayHostComponent,
    ScrollFadeDirective,
    SheetComponent,
    SpeciesPickComponent,
    TranslatePipe,
  ],
  templateUrl: './map-overlays.component.html',
  styleUrl: './map-overlays.component.scss',
})
export class MapOverlaysComponent {
  private readonly i18n = inject(I18nService);
  protected readonly wide = inject(ViewportService).wide;
  protected readonly view = inject(MapView);
  protected readonly state = this.view.state;
  protected readonly combination = this.view.combination;

  readonly open = input.required<Overlay>();
  /** The factor that the factor sheet changes. */
  readonly factor = input<Factor | null>(null);
  readonly closed = output();
  readonly factorApplied = output<Factor>();
  readonly factorRemoved = output<Factor>();
  readonly saved = output<string>();

  /** The factor choice has its own sheet. On the desktop, the factor is in the column. */
  protected readonly shown = computed(
    () => this.open() !== null && this.open() !== 'factors' && !(this.wide() && this.open() === 'factor'),
  );

  protected readonly factorLayer = computed<Layer | null>(() => {
    const factor = this.factor();
    return factor === null ? null : (this.view.sources().get(factor.source) ?? null);
  });

  protected readonly title = computed(() => {
    const open = this.open();
    if (open === 'factor') return this.factorLayer()?.label ?? '';
    const key = open === null ? undefined : TITLE[open];
    return key === undefined ? '' : this.i18n.translate(key);
  });

  protected readonly name = signal('');

  /** The saved combination that the map shows. */
  private readonly shownCombination = computed<Combination | null>(() => {
    const shown = encodeFactors(this.combination.factors());
    return (
      this.combination
        .saved()
        .find((saved) => encodeFactors((saved.factors ?? []).map(fromWire)) === shown) ?? null
    );
  });

  // Each open or close starts the drafts again, so a cancelled choice does not come back.
  /** The species in the sheet. "Apply" takes it, the close button drops it. */
  protected readonly draftSpecies = linkedSignal({
    source: () => ({ open: this.open(), slug: this.view.species()?.value ?? null }),
    computation: ({ slug }): string | null => slug,
  });

  /** The saved combination in the sheet. It starts with the one that the map shows. */
  protected readonly draftCombination = linkedSignal({
    source: () => ({ open: this.open(), shown: this.shownCombination() }),
    computation: ({ shown }): Combination | null => shown,
  });

  /** The delete of the chosen saved combination waits for a confirmation. */
  protected readonly deleteAsk = signal(false);

  protected readonly histogram = computed(() => {
    const layer = this.factorLayer();
    return layer === null ? null : histogramFor(layer, this.view.weekKey());
  });

  protected chooseSpecies(): void {
    const slug = this.draftSpecies();
    if (slug !== null) this.state.setSpecies(slug);
    this.closed.emit();
  }

  protected chooseLayer(layer: Layer): void {
    this.state.setLayer(layer.id);
    this.closed.emit();
  }

  protected pick(): void {
    const chosen = this.draftCombination();
    if (chosen !== null) this.combination.pick(chosen);
    this.closed.emit();
  }

  protected async deleteCombination(): Promise<void> {
    const chosen = this.draftCombination();
    this.deleteAsk.set(false);
    if (chosen === null) return;
    this.draftCombination.set(null);
    await this.combination.delete(chosen);
  }

  protected confirmName(): void {
    const name = this.name().trim();
    if (name === '') return;
    this.name.set('');
    this.saved.emit(name);
  }

  /** The close button and a tap outside the sheet close it and drop the name. */
  protected dismiss(): void {
    this.name.set('');
    this.closed.emit();
  }
}

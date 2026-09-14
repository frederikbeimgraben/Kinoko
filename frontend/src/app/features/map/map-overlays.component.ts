import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { histogramFor, type Layer } from '../../core/tiles/layers';
import type { Combination } from '../../core/api/models';
import { LayerListComponent } from './layer-list.component';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { CombinationsComponent } from './combinations.component';
import { FactorPickerComponent } from './factor-picker.component';
import { FactorSheetComponent } from './factor-sheet.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { SheetComponent } from '../../ui/sheet/sheet.component';
import { SpeciesPickerComponent } from '../../ui/species-picker/species-picker.component';
import { DETENT_SIZES } from './map-surface';
import { MapView } from './map.view';
import type { Factor } from './factors';

/** Welches Blatt gerade über der Karte liegt. */
export type Overlay = 'species' | 'layer' | 'factors' | 'factor' | 'combinations' | 'save' | null;

/** Die Blätter über der Karte. Über der Karte liegt immer nur eines. */
@Component({
  selector: 'app-map-overlays',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ButtonComponent,
    CombinationsComponent,
    FactorPickerComponent,
    FactorSheetComponent,
    FormFieldComponent,
    LayerListComponent,
    OverlayHostComponent,
    SheetComponent,
    SpeciesPickerComponent,
    TranslatePipe,
  ],
  templateUrl: './map-overlays.component.html',
  styleUrl: './map-overlays.component.scss',
})
export class MapOverlaysComponent {
  protected readonly view = inject(MapView);
  protected readonly state = this.view.state;
  protected readonly combination = this.view.combination;

  readonly open = input.required<Overlay>();
  /** Der Faktor, den das Blatt `Faktor` gerade bearbeitet. */
  readonly factor = input<Factor | null>(null);
  readonly closed = output();
  readonly toCatalogue = output();
  readonly factorApplied = output<Factor>();
  readonly factorRemoved = output<Factor>();
  readonly sourceChosen = output<Layer>();
  readonly saved = output<string>();

  /** Ein Blatt über der Karte steht in derselben obersten Raste. */
  protected readonly detents = DETENT_SIZES;

  protected readonly name = signal('');

  protected readonly factorLayer = computed<Layer | null>(() => {
    const factor = this.factor();
    return factor === null ? null : (this.view.sources().get(factor.source) ?? null);
  });

  protected readonly histogram = computed(() => {
    const layer = this.factorLayer();
    return layer === null ? null : histogramFor(layer, this.view.weekKey());
  });

  protected readonly usedSources = computed(
    () => new Set(this.combination.factors().map((factor) => factor.source)),
  );

  protected readonly speciesLayers = computed<readonly Layer[]>(() =>
    [...this.view.sources().values()].filter((layer) =>
      this.view.speciesChoices().some((entry) => entry.value === layer.id),
    ),
  );

  protected chooseSpecies(slug: string): void {
    this.state.species.set(slug);
    this.closed.emit();
  }

  protected chooseLayer(layer: Layer): void {
    this.state.layer.set(layer.id);
    this.closed.emit();
  }

  protected pick(combination: Combination): void {
    this.combination.pick(combination);
    this.closed.emit();
  }

  protected confirmName(): void {
    const name = this.name().trim();
    if (name === '') return;
    this.name.set('');
    this.saved.emit(name);
  }

  protected cancelName(): void {
    this.name.set('');
    this.closed.emit();
  }
}

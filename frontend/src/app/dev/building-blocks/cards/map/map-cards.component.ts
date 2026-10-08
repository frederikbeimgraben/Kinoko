import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Combination } from '../../../../core/api/models';
import { readLayers } from '../../../../core/tiles/layers';
import { CombinationsComponent } from '../../../../features/map/combinations.component';
import { LayerPickComponent } from '../../../../features/map/layer-pick.component';
import { LayersBodyComponent } from '../../../../features/map/layers-body.component';
import { MapStore } from '../../../../features/map/map.store';
import { FormFieldComponent } from '../../../../ui/form-field/form-field.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { MapButtonsComponent } from '../../../../features/map/map-buttons.component';
import { ObjectTitleComponent } from '../../../../ui/object-title/object-title.component';
import { MapPinComponent } from '../../../../ui/map-pin/map-pin.component';
import { ReviewQueueComponent } from '../../../../ui/review-queue/review-queue.component';
import { StateViewComponent } from '../../../../ui/state-view/state-view.component';
import { StepBarComponent, type StepAction } from '../../../../ui/step-bar/step-bar.component';
import { ZoneShapeComponent } from '../../../../ui/zone-shape/zone-shape.component';
import { BlockCardComponent } from '../block-card/block-card.component';

/** The map blocks, each with the values of its board. */
@Component({
  selector: 'app-map-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlockCardComponent,
    CombinationsComponent,
    FormFieldComponent,
    LayerPickComponent,
    LayersBodyComponent,
    MapButtonsComponent,
    MapPinComponent,
    ObjectTitleComponent,
    ReviewQueueComponent,
    StateViewComponent,
    StepBarComponent,
    TranslatePipe,
    ZoneShapeComponent,
  ],
  templateUrl: './map-cards.component.html',
  styleUrl: './map-cards.component.scss',
})
export class MapCardsComponent {
  private readonly i18n = inject(I18nService);

  protected readonly stepBarActions: readonly StepAction[] = [
    {
      label: this.i18n.translate('common.undo'),
      icon: 'undo',
      variant: 'secondary',
      run: () => undefined,
    },
    {
      label: this.i18n.translate('common.cancel'),
      icon: 'close',
      variant: 'secondary',
      run: () => undefined,
    },
    {
      label: this.i18n.translate('beispiel.fertig'),
      icon: 'check',
      variant: 'primary',
      run: () => undefined,
    },
  ];

  protected readonly queueItems: readonly string[] = ['placeholder'];

  /** The three input layers of the board `LayerPickBody`. */
  protected readonly layers = computed(
    () =>
      readLayers({
        layers: {
          regen: {
            label: this.i18n.translate('map.factor.precipitation'),
            note: this.i18n.translate('beispiel.summeKw'),
            tiles: 'regen',
          },
          temperatur: { label: this.i18n.translate('map.factor.meanTemperature'), tiles: 'temperatur' },
          bodenfeuchte: { label: this.i18n.translate('map.factor.soilMoisture'), tiles: 'bodenfeuchte' },
        },
      }).layers,
  );

  /** The two saved combinations of the board `CombinationsBody`. */
  protected readonly combinations = computed<readonly Combination[]>(() => [
    {
      id: 'eins',
      name: this.i18n.translate('beispiel.herbstSteinpilz'),
      rule: 'intersection',
      factors: [
        { source: 'regen', condition: 'above', low: 80, high: null, active: true },
        { source: 'temperatur', condition: 'between', low: 12, high: 18, active: true },
      ],
      updatedAt: '2026-09-01T00:00:00Z',
      deleted: false,
    },
    {
      id: 'zwei',
      name: this.i18n.translate('beispiel.nachRegen'),
      rule: 'intersection',
      factors: [{ source: 'regen', condition: 'above', low: 40, high: null, active: true }],
      updatedAt: '2026-09-01T00:00:00Z',
      deleted: false,
    },
  ]);

  constructor() {
    // Board `LayersBody`: the light map style, 70 % opacity and no zones.
    const map = inject(MapStore);
    map.setBackground('light');
    map.setOpacity(0.7);
    map.setShowZones(false);
  }
}

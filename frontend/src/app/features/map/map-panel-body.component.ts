import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import type { Rule } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import type { Layer } from '../../core/tiles/layers';
import { ButtonComponent } from '../../ui/button/button.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { RampComponent, type RampKind } from '../../ui/ramp/ramp.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { SkeletonComponent } from '../../ui/skeleton/skeleton.component';
import { CombinationComponent } from './combination.component';
import { LayerPickComponent } from './layer-pick.component';
import { MapView } from './map.view';

const RULE_KEY: Record<Rule, TranslationKey> = {
  intersection: 'map.combination.intersection',
  graded: 'map.combination.graduated',
};

/** The rain layers use the blue ramp of the board `MapLayer`. */
const RAIN_LAYERS: readonly string[] = ['regen', 'regen_4w'];

/** The content below the map panel: the legend, the layer or the combination. */
@Component({
  selector: 'app-map-panel-body',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CombinationComponent,
    LayerPickComponent,
    ListRowComponent,
    RampComponent,
    RowGroupComponent,
    SegmentedComponent,
    SkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './map-panel-body.component.html',
  styleUrl: './map-panel-body.component.scss',
})
export class MapPanelBodyComponent {
  private readonly i18n = inject(I18nService);
  protected readonly view = inject(MapView);
  protected readonly state = this.view.state;
  protected readonly combination = this.view.combination;
  protected readonly wide = inject(ViewportService).wide;

  readonly layerChosen = output();
  readonly savedOpened = output();
  readonly factorOpened = output<string>();
  readonly factorAdded = output();
  readonly saveRequested = output();

  /** The short name of the layer, as on the board `MapLayer`. */
  protected readonly layerName = computed(() => this.view.layerName(this.view.layer()));

  protected readonly rampKind = computed<RampKind>(() =>
    RAIN_LAYERS.includes(this.view.layer()?.id ?? '') ? 'rain' : 'forecast',
  );

  protected readonly rules = computed<SegmentOption[]>(() =>
    (['intersection', 'graded'] as const).map((value) => ({
      value,
      label: this.i18n.translate(RULE_KEY[value]),
    })),
  );

  protected setRule(value: string): void {
    if (value === 'intersection' || value === 'graded') this.combination.setRule(value);
  }

  protected chooseLayer(layer: Layer): void {
    this.state.setLayer(layer.id);
  }
}

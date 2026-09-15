import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { layerIcon } from '../../core/tiles/layer-groups';
import type { Layer } from '../../core/tiles/layers';
import { SheetHeadComponent } from '../../ui/sheet-head/sheet-head.component';
import type { IconName } from '../../ui/svg-icon/svg-icon.component';
import type { TimelineWeek } from '../../ui/timeline/timeline.component';
import { FactorSheetComponent } from './factor-sheet.component';
import { MapHeadComponent } from './map-head.component';
import { MapPanelComponent } from './map-panel.component';
import { MapView } from './map.view';
import type { Factor } from './factors';

/** Die Spalte am Rechner: Kopf und Inhalt, beim Faktor dessen Seite. */
@Component({
  selector: 'app-map-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FactorSheetComponent, MapHeadComponent, MapPanelComponent, SheetHeadComponent],
  templateUrl: './map-column.component.html',
  styleUrl: './map-column.component.scss',
})
export class MapColumnComponent {
  private readonly view = inject(MapView);

  readonly factor = input<Factor | null>(null);
  readonly playing = input(false);

  readonly titleChosen = output();
  readonly weekChosen = output<TimelineWeek>();
  readonly stepped = output<1 | -1>();
  readonly playToggled = output();
  readonly layerChosen = output();
  readonly savedOpened = output();
  readonly factorOpened = output<string>();
  readonly factorAdded = output();
  readonly saveRequested = output();
  readonly factorApplied = output<Factor>();
  readonly factorRemoved = output<Factor>();
  readonly closed = output();

  protected readonly layer = computed<Layer | null>(() => {
    const factor = this.factor();
    return factor === null ? null : this.view.layerFor(factor.source);
  });

  protected readonly glyph = computed<IconName | undefined>(() => {
    const source = this.layer();
    return source === null ? undefined : (layerIcon(source.id) ?? undefined);
  });

  protected readonly spread = computed(() => {
    const layer = this.layer();
    return layer === null ? null : this.view.spread(layer);
  });
}

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { Layer } from '../../core/tiles/layers';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
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
  imports: [FactorSheetComponent, MapHeadComponent, MapPanelComponent, PageHeaderComponent],
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

  protected readonly spread = computed(() => {
    const layer = this.layer();
    return layer === null ? null : this.view.spread(layer);
  });
}

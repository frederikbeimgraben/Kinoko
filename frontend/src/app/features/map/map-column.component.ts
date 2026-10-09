import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import type { TimelineWeek } from '../../ui/timeline/timeline.component';
import { MapPanelBodyComponent } from './map-panel-body.component';
import { MapPanelComponent } from './map-panel.component';

/** The column of the desktop: the panel and its body. A factor opens as a modal, per `MapDesktopFactor`. */
@Component({
  selector: 'app-map-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapPanelBodyComponent, MapPanelComponent],
  templateUrl: './map-column.component.html',
  styleUrl: './map-column.component.scss',
})
export class MapColumnComponent {
  readonly titleChosen = output();
  readonly weekChosen = output<TimelineWeek>();
  readonly layerChosen = output();
  readonly savedOpened = output();
  readonly factorOpened = output<string>();
  readonly factorAdded = output();
  readonly saveRequested = output();
}

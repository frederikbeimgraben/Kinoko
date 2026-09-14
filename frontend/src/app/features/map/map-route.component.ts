import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ViewportService } from '../../core/layout/viewport.service';
import { MapComponent } from './map.component';

/** Der Reiter Karte als Route. Am Rechner steht die Karte in der Hülle. */
@Component({
  selector: 'app-map-route',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapComponent],
  templateUrl: './map-route.component.html',
})
export class MapRouteComponent {
  protected readonly wide = inject(ViewportService).wide;
}

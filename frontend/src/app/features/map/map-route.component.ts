import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Der Reiter Karte als Route. Die Karte selbst hängt in der Hülle. */
@Component({
  selector: 'app-map-route',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-route.component.html',
})
export class MapRouteComponent {}

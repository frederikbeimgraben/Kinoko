import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The map tab as a route. The map itself is in the app shell. */
@Component({
  selector: 'app-map-route',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-route.component.html',
})
export class MapRouteComponent {}

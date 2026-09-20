import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  MAP_PIN_BORDER_COLOUR,
  MAP_PIN_BORDER_WIDTH,
  MAP_PIN_DIAMETER,
  MAP_PIN_ON_RING_INNER,
  MAP_PIN_ON_RING_INNER_COLOUR,
  MAP_PIN_ON_RING_OUTER,
  MAP_PIN_ON_RING_OUTER_COLOUR,
} from './map-pin.constants';

/** A marker dot on the map, per `MapPin.dc.html`. */
@Component({
  selector: 'app-map-pin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-pin.component.html',
  styleUrl: './map-pin.component.scss',
})
export class MapPinComponent {
  readonly colour = input('#7a5230');
  /** The selected pin carries a halo ring. */
  readonly on = input(false);

  protected readonly diameter = MAP_PIN_DIAMETER;
  protected readonly borderWidth = MAP_PIN_BORDER_WIDTH;
  protected readonly borderColour = MAP_PIN_BORDER_COLOUR;
  protected readonly ringInner = MAP_PIN_ON_RING_INNER;
  protected readonly ringOuter = MAP_PIN_ON_RING_OUTER;
  protected readonly ringInnerColour = MAP_PIN_ON_RING_INNER_COLOUR;
  protected readonly ringOuterColour = MAP_PIN_ON_RING_OUTER_COLOUR;
}

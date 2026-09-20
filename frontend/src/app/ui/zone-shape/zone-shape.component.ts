import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  ZONE_CORNER_RADIUS,
  ZONE_DEFAULT_COLOUR,
  ZONE_FILL_OPACITY,
  ZONE_STROKE_DASH,
  ZONE_STROKE_WIDTH,
} from './zone-shape.constants';

/** The outline of a zone on the map, per `ZoneShape.dc.html`. */
@Component({
  selector: 'app-zone-shape',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zone-shape.component.html',
  styleUrl: './zone-shape.component.scss',
})
export class ZoneShapeComponent {
  readonly colour = input(ZONE_DEFAULT_COLOUR);
  /** A drawn corner shows dashed edges and its own handles. */
  readonly drawing = input(false);

  protected readonly points = '120,230 250,180 300,270 195,300';
  protected readonly corners: readonly (readonly [number, number])[] = [
    [120, 230],
    [250, 180],
    [300, 270],
    [195, 300],
  ];
  protected readonly fillOpacity = ZONE_FILL_OPACITY;
  protected readonly strokeWidth = ZONE_STROKE_WIDTH;
  protected readonly cornerRadius = ZONE_CORNER_RADIUS;

  protected dash(): string {
    return this.drawing() ? ZONE_STROKE_DASH : '0';
  }
}

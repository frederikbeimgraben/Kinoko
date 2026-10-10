import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MeasurementComponent, type Extent, type Span } from '../measurement/measurement.component';

/** A row of the card: one extent of the body part with its spans. */
export interface MeasurementRow {
  readonly extent: Extent;
  readonly spans: readonly Span[];
  readonly unit: string;
}

/** A row of the card with a text value, for example the shape of the ring. */
export interface FactRow {
  readonly label: string;
  readonly value: string;
}

/** A card for the measures of one body part. It never shows other parts.
 * Text rows such as the ring shape come before the measures. */
@Component({
  selector: 'app-measurement-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MeasurementComponent],
  templateUrl: './measurement-group.component.html',
  styleUrl: './measurement-group.component.scss',
})
export class MeasurementGroupComponent {
  readonly part = input.required<string>();
  readonly measurements = input.required<readonly MeasurementRow[]>();
  readonly facts = input<readonly FactRow[]>([]);
}

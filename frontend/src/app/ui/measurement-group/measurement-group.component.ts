import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MeasurementComponent, type Extent, type Span } from '../measurement/measurement.component';

/** Eine Zeile der Karte: eine Strecke des Körperteils mit ihren Spannen. */
export interface MeasurementRow {
  readonly extent: Extent;
  readonly spans: readonly Span[];
  readonly unit: string;
}

/** Eine Karte für die Maße eines Körperteils. Andere Teile stehen nie daneben. */
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
}

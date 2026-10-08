import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalLayerDirective } from '../modal-layer/modal-layer.directive';

/** Where the card hangs: the distance from the end of the row and from one edge. */
export interface PopoverAnchor {
  readonly top?: number;
  readonly bottom?: number;
  readonly end: number;
}

/** A card at a button, per `kit.css` `.pop`. A press next to it or Escape closes it. */
@Component({
  selector: 'app-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalLayerDirective],
  templateUrl: './popover.component.html',
  styleUrl: './popover.component.scss',
})
export class PopoverComponent {
  readonly open = input.required<boolean>();
  readonly anchor = input.required<PopoverAnchor>();
  readonly label = input.required<string>();
  /** The word above the rows, when the card names a group. */
  readonly heading = input('');

  readonly closed = output();
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalLayerDirective } from '../modal-layer/modal-layer.directive';

/** Wo die Karte hängt: Abstand vom oberen Rand und vom Ende der Zeile. */
export interface PopoverAnchor {
  readonly top: number;
  readonly end: number;
}

/** Eine Karte unter einem Knopf, über einem Scrim. Ein Slot trägt den Inhalt. */
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

  readonly closed = output();
}

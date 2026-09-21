import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalLayerDirective } from '../modal-layer/modal-layer.directive';

/** Wo die Karte hängt: Abstand vom Ende der Zeile und von einer Kante. */
export interface PopoverAnchor {
  readonly top?: number;
  readonly bottom?: number;
  readonly end: number;
}

/** Eine Karte unter einem Knopf. Ein Druck daneben oder Escape schließt sie. */
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
  /** Das Wort über den Zeilen, wenn die Karte eine Gruppe benennt. */
  readonly heading = input('');

  readonly closed = output();
}

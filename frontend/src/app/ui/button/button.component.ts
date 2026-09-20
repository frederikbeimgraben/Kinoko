import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Die sechs Auftritte aus `kit.css` `.btn`. */
export type ButtonKind = 'primary' | 'tonal' | 'outline' | 'text' | 'danger' | 'textdanger';

/** Der Knopf des Kits, per `kit.css` `.btn`. Ersetzt den Vendor-Knopf. */
@Component({
  selector: 'app-push-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  readonly kind = input<ButtonKind>('primary');
  readonly icon = input<IconName>();
  /** Volle Breite des Wirts. */
  readonly wide = input(false);
  /** Ein laufender Auftrag zeigt den Kreisel statt der Beschriftung. */
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit'>('button');
}

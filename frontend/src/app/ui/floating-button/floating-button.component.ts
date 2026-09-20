import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Der schwebende Knopf über der Karte, per `kit.css` `.fab`. `iconOnly` zeigt nur das Icon. */
@Component({
  selector: 'app-floating-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent],
  templateUrl: './floating-button.component.html',
  styleUrl: './floating-button.component.scss',
})
export class FloatingButtonComponent {
  readonly icon = input.required<IconName>();
  /** Der barrierefreie Name. Ohne `iconOnly` steht er auch als Wort da. */
  readonly label = input.required<string>();
  /** Ohne Wort daneben, nur das runde Icon. */
  readonly iconOnly = input(false);
  /** Ein Knopf ohne Wirkung bleibt sichtbar, aber gesperrt. */
  readonly disabled = input(false);
  /** Dreht nur das Zeichen, nicht den Knopf: die Nadel des Kompasses. */
  readonly rotation = input(0);

  readonly pressed = output();
}

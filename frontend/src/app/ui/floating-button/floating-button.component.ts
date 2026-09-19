import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** `default` steht über der Karte, `primary` ist die Hauptaktion. */
export type FloatingVariant = 'default' | 'primary';

/** Ein schwebender Knopf über der Karte: 48 px, eigener Radius. */
@Component({
  selector: 'app-floating-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './floating-button.component.html',
  styleUrl: './floating-button.component.scss',
})
export class FloatingButtonComponent {
  readonly icon = input.required<IconName>();
  readonly label = input.required<string>();
  readonly variant = input<FloatingVariant>('default');
  /** Ein Knopf ohne Wirkung bleibt sichtbar, aber gesperrt. */
  readonly disabled = input(false);
  /** Dreht nur das Zeichen, nicht den Knopf: die Nadel des Kompasses. */
  readonly rotation = input(0);

  readonly pressed = output();
}

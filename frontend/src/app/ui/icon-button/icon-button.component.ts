import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Die drei Handlungen, die eine Zeile als Knopf statt als Text trägt. */
export type IconButtonIcon = 'check' | 'close' | 'delete';

/** Primär füllt sich mit der Markenfarbe, sekundär bleibt nur umrandet. */
export type IconButtonVariant = 'primary' | 'secondary';

/**
 * Ein quadratischer 40-px-Knopf mit einem Icon statt einem Wort. Er steht in
 * Zeilen, wo ein Textknopf zu breit würde: Annehmen, Ablehnen, Löschen.
 */
@Component({
  selector: 'app-icon-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon-button.component.html',
  styleUrl: './icon-button.component.scss',
})
export class IconButtonComponent {
  readonly icon = input.required<IconButtonIcon>();
  readonly variant = input<IconButtonVariant>('secondary');
  /** Der barrierefreie Name. Ohne sichtbares Wort trägt nur er die Bedeutung. */
  readonly label = input.required<string>();
  readonly disabled = input(false);

  readonly pressed = output();
}

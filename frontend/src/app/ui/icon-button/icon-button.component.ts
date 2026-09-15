import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Die drei Handlungen, die eine Zeile als Knopf statt als Text trägt. */
export type IconButtonIcon = 'check' | 'close' | 'delete';

/** Primär füllt sich mit der Markenfarbe, sekundär bleibt nur umrandet. */
export type IconButtonVariant = 'primary' | 'secondary';

/** Maß und Strich je Icon: der Haken trägt schwerer als das X. */
const GLYPHS: Readonly<Record<IconButtonIcon, { size: number; stroke: number }>> = {
  check: { size: 20, stroke: 2.4 },
  close: { size: 18, stroke: 2.2 },
  delete: { size: 18, stroke: 1.8 },
};

/** Ein quadratischer Knopf mit Icon. Er steht, wo ein Textknopf zu breit wäre. */
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

  protected readonly glyph = computed(() => GLYPHS[this.icon()]);
}

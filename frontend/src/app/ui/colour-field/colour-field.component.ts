import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Eine Farbe mit Namen und Wert, wie die Bausteine sie brauchen. */
export interface ColourValue {
  readonly name: string;
  readonly hex: string;
}

/** Wo die harten Kanten liegen, wenn ein Körper mehrere Farben trägt. */
const ANGLE = 104;

/** Ein weicher Verlauf läuft flacher als eine harte Kante. */
const SOFT_ANGLE = 135;

/** Eine Farbe, ein Verlauf über mehrere Stopps, oder mehrere mit harter Kante. */
export type ColourMode = 'single' | 'gradient' | 'multiple';

/** Eine Farbe als Fläche. `multiple` trennt hart, `gradient` blendet weich. */
@Component({
  selector: 'app-colour-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './colour-field.component.html',
  styleUrl: './colour-field.component.scss',
})
export class ColourFieldComponent {
  readonly colours = input.required<readonly ColourValue[]>();
  readonly mode = input<ColourMode>('multiple');
  /** Die Namen zusammen, für Hilfsmittel. Sichtbar stehen sie links am Merkmal. */
  readonly label = input.required<string>();

  protected readonly fill = computed(() => paint(this.colours(), this.mode()));
}

/** Malt die Fläche nach ihrem Modus. Ohne Farbe bleibt sie durchsichtig. */
export function paint(colours: readonly ColourValue[], mode: ColourMode = 'multiple'): string {
  if (colours.length === 0) return 'transparent';
  if (colours.length === 1 || mode === 'single') return colours[0].hex;
  if (mode === 'gradient')
    return `linear-gradient(${SOFT_ANGLE}deg, ${colours.map((colour) => colour.hex).join(', ')})`;
  const share = 100 / colours.length;
  const stops = colours.map((colour, index) => `${colour.hex} ${index * share}% ${(index + 1) * share}%`);
  return `linear-gradient(${ANGLE}deg,${stops.join(',')})`;
}

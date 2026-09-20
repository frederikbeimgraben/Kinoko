import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';

/** Die Piktogramme, die eine Zeile als Knopf statt als Text trägt. */
export type IconButtonIcon = 'check' | 'close' | 'delete' | 'pencil' | 'share' | 'prev' | 'next' | 'undo';

/** Die sieben Auftritte aus `kit.css`, je RoundButton `kind`. */
export type IconButtonKind = 'tonal' | 'plain' | 'fab' | 'fabl' | 'accept' | 'reject' | 'over';

/** Der volle Pfeil aus dem Zwölfer-Raster, wie `app-svg-icon` ihn kennt. */
const FILLED_ICONS: ReadonlySet<IconButtonIcon> = new Set(['prev', 'next']);

const BIG_KINDS: ReadonlySet<IconButtonKind> = new Set(['accept', 'reject']);

/** Maß und Strich je Icon: der Haken trägt schwerer als das X. */
const GLYPHS: Readonly<Record<IconButtonIcon, { size: number; stroke: number }>> = {
  check: { size: 20, stroke: 2.4 },
  close: { size: 18, stroke: 2.2 },
  delete: { size: 18, stroke: 1.8 },
  pencil: { size: 20, stroke: 1.8 },
  share: { size: 18, stroke: 1.8 },
  prev: { size: 12, stroke: 0 },
  next: { size: 12, stroke: 0 },
  undo: { size: 20, stroke: 2 },
};

/** Ein runder Knopf mit Icon, per `kit.css` `.tb`/`.ib`/`.fab-s`/`.rbig`. */
@Component({
  selector: 'app-icon-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective],
  templateUrl: './icon-button.component.html',
  styleUrl: './icon-button.component.scss',
})
export class IconButtonComponent {
  readonly icon = input.required<IconButtonIcon>();
  readonly kind = input<IconButtonKind>('tonal');
  /** Der barrierefreie Name. Ohne sichtbares Wort trägt nur er die Bedeutung. */
  readonly label = input.required<string>();
  readonly disabled = input(false);

  readonly pressed = output();

  protected readonly glyph = computed(() => GLYPHS[this.icon()]);
  protected readonly iconSize = computed(() => (BIG_KINDS.has(this.kind()) ? 32 : this.glyph().size));
  protected readonly filled = computed(() => FILLED_ICONS.has(this.icon()));
}

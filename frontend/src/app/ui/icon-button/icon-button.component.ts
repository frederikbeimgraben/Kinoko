import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** The glyphs of a button without text. */
export type OwnIcon =
  'check' | 'close' | 'delete' | 'pencil' | 'share' | 'sign-out' | 'prev' | 'next' | 'undo';

/** The button takes its own glyphs and each glyph of the catalogue. */
export type IconButtonIcon = OwnIcon | IconName;

const OWN_ICONS: ReadonlySet<string> = new Set<OwnIcon>([
  'check',
  'close',
  'delete',
  'pencil',
  'share',
  'sign-out',
  'prev',
  'next',
  'undo',
]);

/** The seven looks of `kit.css`, one for each RoundButton `kind`. */
export type IconButtonKind = 'tonal' | 'plain' | 'fab' | 'fabl' | 'accept' | 'reject' | 'over';

/** The filled arrow of the 12 px grid, as `app-svg-icon` has it. */
const FILLED_ICONS: ReadonlySet<IconButtonIcon> = new Set(['prev', 'next']);

const BIG_KINDS: ReadonlySet<IconButtonKind> = new Set(['accept', 'reject']);

/** The size and the stroke of a catalogue glyph, per `kit.css` `.ic`. */
const CATALOGUE_GLYPH = { size: 24, stroke: 1.8 } as const;

/** The size and the stroke of each icon: the check is heavier than the X. */
const GLYPHS: Readonly<Partial<Record<IconButtonIcon, { size: number; stroke: number }>>> = {
  check: { size: 20, stroke: 2.4 },
  close: { size: 18, stroke: 2.2 },
  delete: { size: 18, stroke: 1.8 },
  pencil: { size: 20, stroke: 1.8 },
  share: { size: 18, stroke: 1.8 },
  'sign-out': { size: 20, stroke: 1.8 },
  prev: { size: 24, stroke: 0 },
  next: { size: 24, stroke: 0 },
  undo: { size: 20, stroke: 2 },
};

/** A round button with an icon, per `kit.css` `.tb`/`.ib`/`.fab-s`/`.rbig`. */
@Component({
  selector: 'app-icon-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent],
  templateUrl: './icon-button.component.html',
  styleUrl: './icon-button.component.scss',
})
export class IconButtonComponent {
  readonly icon = input.required<IconButtonIcon>();
  readonly kind = input<IconButtonKind>('tonal');
  /** The accessible name. Without a visible word, only it gives the meaning. */
  readonly label = input.required<string>();
  readonly disabled = input(false);

  readonly pressed = output();

  protected readonly own = computed(() => OWN_ICONS.has(this.icon()) && this.kind() !== 'fabl');
  protected readonly catalogue = computed(() => this.icon() as IconName);
  /** The large square button of `StepBar.dc.html` draws each icon at the catalogue size. */
  protected readonly glyph = computed(() =>
    this.kind() === 'fabl' ? CATALOGUE_GLYPH : (GLYPHS[this.icon()] ?? CATALOGUE_GLYPH),
  );
  protected readonly iconSize = computed(() => (BIG_KINDS.has(this.kind()) ? 32 : this.glyph().size));
  protected readonly filled = computed(() => FILLED_ICONS.has(this.icon()));
}

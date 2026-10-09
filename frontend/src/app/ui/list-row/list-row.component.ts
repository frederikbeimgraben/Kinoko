import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LevelPillComponent, type BadgeKind } from '../level-pill/level-pill.component';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Only `link` changes the look: it gives the title the link colour. The other kinds keep the kit row. */
export type ListRowKind = 'default' | 'catalogue' | 'filter' | 'link';

/** The kit row variants: `head` makes the label bold, `sub` makes it dim. */
export type ListRowVariant = 'plain' | 'head' | 'sub';

/** A row per `kit.css` `.row` and `Row.dc.html`: label, sub-line, value, trailing parts and an action. */
@Component({
  selector: 'app-list-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LevelPillComponent, NgTemplateOutlet, RippleDirective, SvgIconComponent],
  templateUrl: './list-row.component.html',
  styleUrl: './list-row.component.scss',
})
export class ListRowComponent {
  readonly title = input.required<string>();
  readonly subline = input<string>();
  /** The language of the subline where it is not the language of the page, for example a German catalogue text. */
  readonly sublineLang = input<string | null>(null);
  /** The `.val` value: tabular figures at weight 500. */
  readonly value = input<string>();
  /** A small unit after the value, in the label colour. */
  readonly unit = input<string>();
  /** A plain trailing text at 14 px in the label colour. */
  readonly plain = input<string>();
  readonly badge = input<string>();
  readonly badgeKind = input<BadgeKind>('');
  /** A CSS background for the `.sw` swatch, for example a gradient. */
  readonly swatch = input<string>();
  /** The primary colour for the title or the value. Without a chevron, the title gets it as a link sign. */
  readonly accent = input(false);
  readonly kind = input<ListRowKind>('default');
  readonly variant = input<ListRowVariant>('plain');
  /** A dim icon before the label. */
  readonly icon = input<IconName>();
  /** A 44 px thumb in the lead slot needs the smaller start padding of `.row.thumbed`. */
  readonly thumbed = input(false);
  /** The sub-line breaks into more lines, per `.row.wrap`. */
  readonly wrap = input(false);
  readonly chevron = input(false);
  readonly clickable = input(false);
  /** A selected row reports itself as pressed. */
  readonly selected = input(false);

  readonly chosen = output();

  /** The kit makes the label bold for a head row and for a row with a sub-line. */
  protected readonly strong = computed(() => this.variant() === 'head' || !!this.subline());
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** A named level reads its colour from a token pair, per `kit.css` `.badge`. */
export type BadgeKind = '' | 'ok' | 'warn' | 'bad';

/** Eine Plakette. Eine Art nimmt die Tonfarbe, sonst gilt die eigene Farbe. */
@Component({
  selector: 'app-level-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './level-pill.component.html',
  styleUrl: './level-pill.component.scss',
})
export class LevelPillComponent {
  readonly text = input.required<string>();
  readonly colour = input<string>();
  /** Die Fläche. Ohne Angabe mischt sie sich aus der Farbe. */
  readonly background = input<string>();
  readonly kind = input<BadgeKind>('');
  /** Ein Zeichen vor dem Wort, wie bei der Melde-Warnung ohne Netz. */
  readonly icon = input<IconName>();
}

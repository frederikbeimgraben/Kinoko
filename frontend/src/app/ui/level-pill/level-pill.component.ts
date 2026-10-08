import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** A named level reads its colour from a token pair, per `kit.css` `.badge`. */
export type BadgeKind = '' | 'ok' | 'warn' | 'bad';

/** The kit badge. A kind sets the tone colours. Without a kind, the own colour applies. */
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
  /** The area colour. Without a value, the tonal area applies. */
  readonly background = input<string>();
  readonly kind = input<BadgeKind>('');
  /** An icon before the text, for example the offline warning. */
  readonly icon = input<IconName>();
}

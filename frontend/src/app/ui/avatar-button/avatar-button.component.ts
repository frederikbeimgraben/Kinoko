import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** The circle at the top left of the map. It opens the account. */
@Component({
  selector: 'app-avatar-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SkeletonComponent, SvgIconComponent],
  templateUrl: './avatar-button.component.html',
  styleUrl: './avatar-button.component.scss',
})
export class AvatarButtonComponent {
  /** `null` while the session loads: the circle shows a skeleton. Without a name (a guest) it shows the person icon. */
  readonly name = input.required<string | null>();
  readonly label = input.required<string>();

  readonly pressed = output();

  protected readonly initial = computed(() => (this.name() ?? '').trim().charAt(0).toUpperCase());
}

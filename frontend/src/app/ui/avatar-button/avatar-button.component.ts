import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/** The circle at the top left of the map. It opens the account. */
@Component({
  selector: 'app-avatar-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SkeletonComponent],
  templateUrl: './avatar-button.component.html',
  styleUrl: './avatar-button.component.scss',
})
export class AvatarButtonComponent {
  /** `null` while the session loads. The circle then shows a skeleton. */
  readonly name = input.required<string | null>();
  readonly label = input.required<string>();

  readonly pressed = output();

  protected readonly initial = computed(() => (this.name() ?? '').trim().charAt(0).toUpperCase());
}

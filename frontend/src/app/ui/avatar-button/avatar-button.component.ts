import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/** Der Kreis oben links auf der Karte. Er führt zum Konto. */
@Component({
  selector: 'app-avatar-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  templateUrl: './avatar-button.component.html',
  styleUrl: './avatar-button.component.scss',
})
export class AvatarButtonComponent {
  /** `null`, solange die Sitzung offen ist. Dann trägt der Kreis ein Skelett. */
  readonly name = input.required<string | null>();
  readonly label = input.required<string>();

  readonly pressed = output();

  protected readonly initial = computed(() => (this.name() ?? '').trim().charAt(0).toUpperCase());
}

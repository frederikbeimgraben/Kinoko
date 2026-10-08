import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/** A review card while the queue loads, per `kit.css` `.qcard`: the media, three lines and the round actions. */
@Component({
  selector: 'app-queue-card-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  templateUrl: './queue-card-skeleton.component.html',
  styleUrl: './queue-card-skeleton.component.scss',
  host: { 'aria-hidden': 'true' },
})
export class QueueCardSkeletonComponent {
  /** The height of the media part of the card. */
  readonly mediaHeight = input('240px');
}

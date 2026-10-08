import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SkeletonComponent } from './skeleton.component';

/**
 * The species page while it loads. Put a real back button in the `[lead]` slot to let the person leave.
 */
@Component({
  selector: 'app-species-page-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  templateUrl: './species-page-skeleton.component.html',
  styleUrl: './species-page-skeleton.component.scss',
})
export class SpeciesPageSkeletonComponent {
  /** The hero height: 260 px on the phone, 210 px on the desktop. */
  readonly heroHeight = input('260px');

  protected readonly labels: readonly number[] = [0, 3, 6];
}

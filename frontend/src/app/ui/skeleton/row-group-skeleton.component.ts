import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SkeletonComponent, type SkeletonLead, type SkeletonTrail } from './skeleton.component';

/** A `.grp` of `.row` cards while a list loads, with an optional `.lbl` line above it. */
@Component({
  selector: 'app-row-group-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  templateUrl: './row-group-skeleton.component.html',
  host: { 'aria-hidden': 'true', style: 'display: block' },
})
export class RowGroupSkeletonComponent {
  readonly count = input(3);
  /** True for a section label above the group. */
  readonly label = input(false);
  readonly lead = input<SkeletonLead>('none');
  readonly trail = input<SkeletonTrail>('none');
  readonly lines = input<1 | 2 | 3>(1);

  protected readonly labels = computed(() => (this.label() ? [0] : []));
}

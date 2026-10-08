import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/** One option of the segmented control. */
export interface SegmentOption {
  value: string;
  label: string;
}

/**
 * Two, three or four values side by side. The arrow keys change the selection.
 */
@Component({
  selector: 'app-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SkeletonComponent],
  templateUrl: './segmented.component.html',
  styleUrl: './segmented.component.scss',
})
export class SegmentedComponent {
  readonly options = input.required<readonly SegmentOption[]>();
  readonly value = input<string | null>(null);
  readonly label = input.required<string>();
  /** A locked segment shows but the user cannot select it. */
  readonly locked = input(false);
  /** Without data, the tabs show placeholders and not their labels. */
  readonly loading = input(false);

  readonly valueChange = output<string>();

  protected onKey(event: KeyboardEvent, index: number): void {
    if (this.locked()) return;
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    const options = this.options();
    const target = (index + step + options.length) % options.length;
    event.preventDefault();
    this.valueChange.emit(options[target].value);
  }
}

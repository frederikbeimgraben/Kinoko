import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** The last row of a list. It adds a new entry. */
@Component({
  selector: 'app-add-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent],
  templateUrl: './add-row.component.html',
  styleUrl: './add-row.component.scss',
})
export class AddRowComponent {
  readonly label = input.required<string>();
  /** The accessible name. It names the action, not only the item. */
  readonly action = input.required<string>();

  readonly pressed = output();
}

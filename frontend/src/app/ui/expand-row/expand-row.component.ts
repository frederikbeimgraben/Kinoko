import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

let nextId = 0;

/** A row that opens and closes its content, per `kit.css` `.xp`. */
@Component({
  selector: 'app-expand-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent],
  templateUrl: './expand-row.component.html',
  styleUrl: './expand-row.component.scss',
})
export class ExpandRowComponent {
  readonly label = input.required<string>();
  readonly value = input<string>();
  /** The colour of the small dot next to the value, if one is set. */
  readonly dot = input<string>();
  readonly open = model(true);
  /** The 48 px head, for a row that carries more than a single line. */
  readonly tall = input(false);

  protected readonly contentId = `expand-row-${(nextId += 1)}`;

  protected toggle(): void {
    this.open.set(!this.open());
  }
}

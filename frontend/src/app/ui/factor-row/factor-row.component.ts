import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** A combination factor: name, range and bound. */
export interface CombinationFactor {
  readonly name: string;
  readonly range?: string;
  readonly condition: string;
}

/** The row of a factor: group icon, name with range, bound and a remove button. */
@Component({
  selector: 'app-factor-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, RippleDirective, SvgIconComponent],
  templateUrl: './factor-row.component.html',
  styleUrl: './factor-row.component.scss',
})
export class FactorRowComponent {
  readonly factor = input.required<CombinationFactor>();
  /** The icon of the layer group before the name. */
  readonly icon = input<IconName>();
  /** The accessible name of the button that removes the factor. */
  readonly removeLabel = input.required<string>();

  readonly conditionClick = output();
  readonly remove = output();
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Eine Zeile im Popover: Zeichen, Wort, gewählter Zustand. */
@Component({
  selector: 'app-popover-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent],
  templateUrl: './popover-item.component.html',
  styleUrl: './popover-item.component.scss',
})
export class PopoverItemComponent {
  readonly label = input.required<string>();
  readonly icon = input<IconName>();
  readonly active = input(false);

  readonly chosen = output();
}

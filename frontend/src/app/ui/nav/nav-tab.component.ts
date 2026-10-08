import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** A tab of the main navigation, as in `NavTab.dc.html`. */
@Component({
  selector: 'app-nav-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, RouterLink, SvgIconComponent],
  templateUrl: './nav-tab.component.html',
  styleUrl: './nav-tab.component.scss',
})
export class NavTabComponent {
  readonly icon = input.required<IconName>();
  readonly label = input.required<string>();
  readonly path = input.required<string>();
  readonly active = input(false);
  /** On desktop, the tab is in the rail and keeps its width. */
  readonly rail = input(false);
}

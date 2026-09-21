import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Ein Reiter der Hauptnavigation, per `NavTab.dc.html`. */
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
  /** Am Rechner steht der Reiter in der Schiene und hält seine Breite. */
  readonly rail = input(false);
}

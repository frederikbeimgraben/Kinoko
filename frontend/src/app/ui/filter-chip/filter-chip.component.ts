import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** A toggle or a removable mark, per `kit.css` `.chip`. */
@Component({
  selector: 'app-filter-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent, TranslatePipe],
  templateUrl: './filter-chip.component.html',
  styleUrl: './filter-chip.component.scss',
})
export class FilterChipComponent {
  readonly label = input.required<string>();
  readonly icon = input<IconName>();
  readonly dot = input<string>();
  readonly on = input(false);
  readonly caret = input(false);
  readonly clear = input(false);
  readonly small = input(false);
  /** Der barrierefreie Name, wo die Beschriftung leer bleibt: nur das Zeichen zeigt sich. */
  readonly iconLabel = input<string>();

  readonly chosen = output();
  readonly removed = output();
}

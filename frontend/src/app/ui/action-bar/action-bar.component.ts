import {
  ChangeDetectionStrategy,
  Component,
  HostAttributeToken,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { ViewportService } from '../../core/layout/viewport.service';
import { ButtonComponent, type ButtonKind } from '../button/button.component';

/** The actions of a sheet or a page: the main action and at most one second action.
 * In the `foot` slot of `app-sheet`, it floats over the body, per `kit.css` `.sact` and `.mact`. */
@Component({
  selector: 'app-action-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  templateUrl: './action-bar.component.html',
  styleUrl: './action-bar.component.scss',
  host: { '[class.action-bar--modal]': 'modal()' },
})
export class ActionBarComponent {
  readonly primary = input.required<string>();
  readonly secondary = input<string>();
  /** Colours the main action red instead of green, for example for "Delete all". */
  readonly danger = input(false);
  /** Colours the second action red, for example for "Remove factor". */
  readonly secondaryDanger = input(false);
  /** In a modal, the buttons stand side by side at the right edge. */
  readonly inline = input(false);
  /** Two actions of the same rank: the main action has no weight. */
  readonly quiet = input(false);
  /** The last action has no fill. */
  readonly ghost = input(false);
  /** The main action runs: a spinner instead of the text, and no second request. */
  readonly busy = input(false);
  /** Both actions stand side by side and share the width. */
  readonly split = input(false);
  /** The main action stands on the left, as some boards show it. */
  readonly leadFirst = input(false);

  readonly primaryClick = output();
  readonly secondaryClick = output();

  /** In the `foot` slot of a sheet, the bar uses the layout of the kit. */
  protected readonly foot = inject(new HostAttributeToken('foot'), { optional: true }) !== null;
  private readonly wide = inject(ViewportService).wide;

  /** On the desktop, a sheet is a modal and its foot is `.mact`. */
  protected readonly modal = computed(() => this.foot && this.wide());

  /** A running request keeps its fill. Only the second action goes. */
  protected readonly primaryVariant = computed<ButtonKind>(() => {
    if (this.ghost() && this.secondary() === undefined && !this.busy()) return 'text';
    if (this.danger()) return this.split() && !this.foot ? 'textdanger' : 'danger';
    return this.quiet() ? 'tonal' : 'primary';
  });

  /** A button without fill shows the danger colour on its text, not as a fill. */
  protected readonly quietDanger = computed(() => this.ghost() && this.danger());

  protected readonly secondaryVariant = computed<ButtonKind>(() => {
    if (this.modal()) return this.secondaryDanger() ? 'textdanger' : 'text';
    if (this.ghost()) return 'text';
    if (this.foot) return this.secondaryDanger() ? 'danger' : 'tonal';
    return this.secondaryDanger() ? 'textdanger' : 'tonal';
  });

  /** A button without fill shows the danger colour on its text, not as a fill. */
  protected readonly quietSecondaryDanger = computed(() => this.ghost() && this.secondaryDanger());
}

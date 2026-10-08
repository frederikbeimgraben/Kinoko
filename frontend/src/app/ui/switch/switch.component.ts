import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** An on or off state, from `kit.css` `.sw-t`. */
@Component({
  selector: 'app-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './switch.component.html',
  styleUrl: './switch.component.scss',
})
export class SwitchComponent {
  readonly checked = input.required<boolean>();
  /** The accessible name. It tells what the switch controls. */
  readonly label = input.required<string>();
  /** A state that cannot go back locks the switch when it is on. */
  readonly disabled = input(false);

  readonly checkedChange = output<boolean>();

  protected toggle(): void {
    if (this.disabled()) return;
    this.checkedChange.emit(!this.checked());
  }
}

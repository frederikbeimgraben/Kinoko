import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Ein Zustand an oder aus, per `kit.css` `.sw-t`. */
@Component({
  selector: 'app-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './switch.component.html',
  styleUrl: './switch.component.scss',
})
export class SwitchComponent {
  readonly checked = input.required<boolean>();
  /** Der barrierefreie Name. Er nennt, was der Schalter schaltet. */
  readonly label = input.required<string>();
  /** Ein Zustand ohne Rückweg sperrt den Schalter, sobald er an ist. */
  readonly disabled = input(false);

  readonly checkedChange = output<boolean>();

  protected toggle(): void {
    if (this.disabled()) return;
    this.checkedChange.emit(!this.checked());
  }
}

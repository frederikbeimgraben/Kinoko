import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Ein Zustand an oder aus: die Pille aus den Brettern. */
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

  readonly checkedChange = output<boolean>();

  protected toggle(): void {
    this.checkedChange.emit(!this.checked());
  }
}

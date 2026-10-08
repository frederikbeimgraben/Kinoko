import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** A row with a round mark, per `RadioRow.dc.html` and `kit.css` `.box-r`. */
@Component({
  selector: 'app-choice-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './choice-row.component.html',
  styleUrl: './choice-row.component.scss',
})
export class ChoiceRowComponent {
  readonly label = input.required<string>();
  readonly subline = input<string>();
  /** The count before the mark, per `.num`. */
  readonly count = input<string>();
  readonly checked = input(false);

  readonly toggled = output<boolean>();

  protected onChange(event: Event): void {
    this.toggled.emit((event.target as HTMLInputElement).checked);
  }
}

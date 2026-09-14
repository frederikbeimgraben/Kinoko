import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Wert im Filter: Kästchen, Name und die Zahl der treffenden Arten. */
@Component({
  selector: 'app-choice-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './choice-row.component.html',
  styleUrl: './choice-row.component.scss',
})
export class ChoiceRowComponent {
  readonly label = input.required<string>();
  readonly count = input<string>();
  readonly checked = input(false);

  readonly toggled = output<boolean>();

  protected onChange(event: Event): void {
    this.toggled.emit((event.target as HTMLInputElement).checked);
  }
}

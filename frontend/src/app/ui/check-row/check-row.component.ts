import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

let nextNumber = 0;

/** Zeile mit Kästchen: Haken links, Titel und Unterzeile rechts. */
@Component({
  selector: 'app-check-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './check-row.component.html',
  styleUrl: './check-row.component.scss',
})
export class CheckRowComponent {
  readonly title = input.required<string>();
  readonly subline = input<string>();
  readonly checked = input(false);
  /** Eine feste Rolle trägt jedes Recht und lässt es sich nicht abwählen. */
  readonly locked = input(false);

  readonly toggled = output<boolean>();

  protected readonly fieldId = `app-check-row-${nextNumber++}`;

  protected onToggle(event: Event): void {
    this.toggled.emit((event.target as HTMLInputElement).checked);
  }
}

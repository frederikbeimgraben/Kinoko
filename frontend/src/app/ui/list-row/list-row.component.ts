import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Zeile mit Titel, Unterzeile, Wert und Chevron, dazu Slots vorn, hinten und als Aktion. */
@Component({
  selector: 'app-list-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, SvgIconComponent],
  templateUrl: './list-row.component.html',
  styleUrl: './list-row.component.scss',
})
export class ListRowComponent {
  readonly title = input.required<string>();
  readonly subline = input<string>();
  readonly value = input<string>();
  readonly chevron = input(false);
  readonly clickable = input(false);
  /** Eine gewählte Zeile meldet sich als gedrückt. */
  readonly selected = input(false);

  readonly chosen = output();
}

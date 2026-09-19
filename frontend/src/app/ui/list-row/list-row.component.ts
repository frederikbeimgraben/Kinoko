import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Wo die Zeile steht: frei, in einer Karte, im Filter oder als Verweis. */
export type ListRowKind = 'default' | 'catalogue' | 'filter' | 'link';

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
  /** Primärfarbe für Titel oder Wert; ohne Chevron trägt der Titel sie als Linkzeichen. */
  readonly accent = input(false);
  /** Polster, Abstand und Titelschrift folgen dem Ort der Zeile. */
  readonly kind = input<ListRowKind>('default');
  /** Ein Zeichen vor dem Titel, gedämpft: die Gruppe einer Ebene. */
  readonly icon = input<IconName>();
  readonly chevron = input(false);
  readonly clickable = input(false);
  /** Eine gewählte Zeile meldet sich als gedrückt. */
  readonly selected = input(false);

  readonly chosen = output();
}

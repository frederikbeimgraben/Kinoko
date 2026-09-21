import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/** Der Kopf des Blatts: Titel, Woche und darunter die Zeitleiste. */
@Component({
  selector: 'app-sheet-head',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './sheet-head.component.html',
  styleUrl: './sheet-head.component.scss',
})
export class SheetHeadComponent {
  readonly title = input.required<string>();
  /** Ein Zeichen vor dem Titel, gedämpft: die Gruppe einer Ebene. */
  readonly icon = input<IconName>();
  readonly titleLink = input(false);
  readonly week = input<string>();
  /** Ein Zusatz in gedämpfter Schrift, etwa der Zeitraum einer Ebene. */
  readonly note = input<string>();
  readonly hint = input<string>();
  /** Ein Zurück-Pfeil vor dem Titel, wenn der Kopf aus einer Ansicht führt. */
  readonly back = input(false);
  /** Ohne Daten steht statt des Titels ein Platzhalter. */
  readonly loading = input(false);

  readonly titleClick = output();
  readonly backClick = output();
}

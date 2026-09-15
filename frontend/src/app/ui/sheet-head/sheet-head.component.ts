import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { TranslationKey } from '../../core/i18n/translations';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/** Ein Pfeil der Kopfzeile und sein Textschlüssel. */
interface Arrow {
  readonly key: TranslationKey;
  readonly icon: 'left' | 'right';
}

const BACK: Arrow = { key: 'map.week.previous', icon: 'left' };
const FORWARD: Arrow = { key: 'map.week.next', icon: 'right' };

/** Der Kopf des Blatts: Titel, Woche, Pfeilgruppe und darunter die Zeitleiste. */
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
  readonly arrows = input(true);
  /** Ein Zurück-Pfeil vor dem Titel, wenn der Kopf aus einer Ansicht führt. */
  readonly back = input(false);
  readonly playing = input(false);
  /** Ohne Daten steht statt des Titels ein Platzhalter. */
  readonly loading = input(false);

  readonly titleClick = output();
  readonly backClick = output();
  readonly stepBack = output();
  readonly playback = output();
  readonly forward = output();

  protected readonly backArrow = BACK;
  protected readonly forwardArrow = FORWARD;
}

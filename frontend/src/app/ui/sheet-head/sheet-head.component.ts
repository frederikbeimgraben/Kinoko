import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { TranslationKey } from '../../core/i18n/translations';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

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
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './sheet-head.component.html',
  styleUrl: './sheet-head.component.scss',
})
export class SheetHeadComponent {
  readonly title = input.required<string>();
  readonly titleLink = input(false);
  readonly week = input<string>();
  readonly hint = input<string>();
  readonly arrows = input(true);
  readonly playing = input(false);

  readonly titleClick = output();
  readonly back = output();
  readonly playback = output();
  readonly forward = output();

  protected readonly backArrow = BACK;
  protected readonly forwardArrow = FORWARD;
}

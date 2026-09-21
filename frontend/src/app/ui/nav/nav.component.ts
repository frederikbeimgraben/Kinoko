import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TranslationKey } from '../../core/i18n/translations';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { IconName } from '../svg-icon/svg-icon.component';
import { NavTabComponent } from './nav-tab.component';

/** Ein Reiter der Hauptnavigation, fest für die ganze App. */
interface NavTab {
  readonly path: string;
  readonly icon: IconName;
  readonly labelKey: TranslationKey;
}

/** Unten am Telefon, als Schiene mit Avatar-Slot am Rechner. */
export type NavVariant = 'bottom' | 'rail';

const TABS: readonly NavTab[] = [
  { path: '/karte', icon: 'map', labelKey: 'nav.tab.map' },
  { path: '/arten', icon: 'mushroom', labelKey: 'nav.tab.species' },
  { path: '/eintraege', icon: 'entries', labelKey: 'nav.tab.entries' },
];

/** Die drei Reiter. Der aktive Pfad kommt als Eingabe, nicht aus der Route. */
// Am Rechner steht unter den Reitern ein Slot für den Avatar-Knopf.
@Component({
  selector: 'app-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavTabComponent, TranslatePipe],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.scss',
})
export class NavComponent {
  readonly active = input<string | null>(null);
  readonly variant = input<NavVariant>('bottom');

  protected readonly tabs = TABS;
}

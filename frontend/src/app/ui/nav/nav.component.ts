import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TranslationKey } from '../../core/i18n/translations';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { IconName } from '../svg-icon/svg-icon.component';
import { NavTabComponent } from './nav-tab.component';

/** A tab of the main navigation. The set is fixed for the full app. */
interface NavTab {
  readonly path: string;
  readonly icon: IconName;
  readonly labelKey: TranslationKey;
}

/** At the bottom on a phone. On desktop, a rail with an avatar slot. */
export type NavVariant = 'bottom' | 'rail';

const TABS: readonly NavTab[] = [
  { path: '/karte', icon: 'map', labelKey: 'nav.tab.map' },
  { path: '/arten', icon: 'mushroom', labelKey: 'nav.tab.species' },
  { path: '/eintraege', icon: 'entries', labelKey: 'nav.tab.entries' },
];

/** The three tabs. The active path comes as an input, not from the route. */
// On desktop, a slot for the avatar button is below the tabs.
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

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SUPPORTED_LOCALES } from '../../core/i18n/translations';
import { MapAppStore, type MapApp } from '../../core/maps/map-app.store';
import { ThemeStore, type ThemeChoice } from '../../core/theme/theme.store';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';

/** The three themes in the order of the board. */
const THEMES: readonly ThemeChoice[] = ['hell', 'dunkel', 'system'];

/** OpenStreetMap before Google Maps, as the board shows them. */
const MAP_APPS: readonly MapApp[] = ['osm', 'google'];

/** Theme, language and map app as kit `.field` segments. */
@Component({
  selector: 'app-appearance-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SegmentedComponent, TranslatePipe],
  templateUrl: './appearance-fields.component.html',
  styleUrl: './appearance-fields.component.scss',
})
export class AppearanceFieldsComponent {
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeStore);
  private readonly mapApp = inject(MapAppStore);

  protected readonly themeChoice = this.theme.choice;
  protected readonly mapAppChoice = this.mapApp.choice;
  /** The board offers two languages. A choice of `system` shows the language that it gives. */
  protected readonly locale = this.i18n.locale;

  protected readonly themes = computed<SegmentOption[]>(() =>
    THEMES.map((choice) => ({ value: choice, label: this.i18n.translate(`theme.${choice}`) })),
  );

  protected readonly languages = computed<SegmentOption[]>(() =>
    SUPPORTED_LOCALES.map((value) => ({ value, label: this.i18n.translate(`sprache.${value}`) })),
  );

  protected readonly mapApps = computed<SegmentOption[]>(() =>
    MAP_APPS.map((choice) => ({ value: choice, label: this.i18n.translate(`account.mapApp.${choice}`) })),
  );

  protected selectTheme(value: string): void {
    const choice = THEMES.find((candidate) => candidate === value);
    if (choice) this.theme.setChoice(choice);
  }

  protected selectLanguage(value: string): void {
    const choice = SUPPORTED_LOCALES.find((candidate) => candidate === value);
    if (choice) this.i18n.setChoice(choice);
  }

  protected selectMapApp(value: string): void {
    const choice = MAP_APPS.find((candidate) => candidate === value);
    if (choice) this.mapApp.setChoice(choice);
  }
}

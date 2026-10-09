import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ThemeStore } from '../../core/theme/theme.store';
import type { Background } from '../../map/background';
import { ChoiceRowComponent } from '../../ui/choice-row/choice-row.component';
import { RangeSliderComponent } from '../../ui/range-slider/range-slider.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { SwitchComponent } from '../../ui/switch/switch.component';
import { MapStore } from './map.store';
import { MapView } from './map.view';

/** The ground of the map: the drawn map, the satellite image or the terrain. */
type Ground = 'map' | 'satellite' | 'topo';

/** The style of the drawn map. */
type MapStyle = 'light' | 'dark';

interface GroundChoice {
  readonly value: Ground;
  readonly label: TranslationKey;
  readonly sub?: TranslationKey;
}

interface ShownSwitch {
  readonly label: TranslationKey;
  readonly on: boolean;
  readonly change: (on: boolean) => void;
}

const GROUNDS: readonly GroundChoice[] = [
  { value: 'map', label: 'map.basemap.map' },
  { value: 'satellite', label: 'map.basemap.aerial', sub: 'map.basemap.aerialCredit' },
  { value: 'topo', label: 'map.basemap.terrain' },
];

/** The content of the layers sheet, per the board `LayersBody`. */
@Component({
  selector: 'app-layers-body',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChoiceRowComponent,
    RangeSliderComponent,
    RowGroupComponent,
    SectionComponent,
    SegmentedComponent,
    SwitchComponent,
    TranslatePipe,
  ],
  templateUrl: './layers-body.component.html',
  styleUrl: './layers-body.component.scss',
})
export class LayersBodyComponent {
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeStore);
  private readonly state = inject(MapStore);
  private readonly view = inject(MapView);

  readonly changed = output<Background>();

  protected readonly grounds = GROUNDS;

  protected readonly ground = computed<Ground>(() => {
    const background = this.state.background();
    return background === 'topo' || background === 'satellite' ? background : 'map';
  });

  /** The style that the theme of the app gives. */
  private readonly themeStyle = computed<MapStyle>(() =>
    this.theme.effective() === 'hell' ? 'light' : 'dark',
  );

  /** "Map" follows the theme of the app. "Light" and "dark" are fixed. */
  protected readonly style = computed<MapStyle>(() => {
    const background = this.state.background();
    return background === 'light' || background === 'dark' ? background : this.themeStyle();
  });

  protected readonly styles = computed<SegmentOption[]>(() => [
    { value: 'light', label: this.i18n.translate('map.layers.style.light') },
    { value: 'dark', label: this.i18n.translate('map.layers.style.dark') },
  ]);

  protected readonly percent = computed(() => Math.round(this.state.opacity() * 100));

  protected readonly switches = computed<readonly ShownSwitch[]>(() => [
    {
      label: 'entry.finds',
      on: this.state.showSharedFinds(),
      change: (on) => {
        this.state.setShowSharedFinds(on);
      },
    },
    {
      label: 'entry.markers',
      on: this.state.showMarkers(),
      change: (on) => {
        this.state.setShowMarkers(on);
      },
    },
    {
      label: 'entry.zones',
      on: this.state.showZones(),
      change: (on) => {
        this.state.setShowZones(on);
      },
    },
    ...(this.view.onLayer()
      ? [
          {
            label: 'map.forecastBelow' as const,
            on: this.state.forecastBelow(),
            change: (on: boolean) => {
              this.state.setForecastBelow(on);
            },
          },
        ]
      : []),
  ]);

  protected chooseGround(ground: Ground): void {
    if (ground !== this.ground()) this.choose(ground);
  }

  // The style of the theme stores "map", so the map follows a later change of the theme again.
  protected chooseStyle(value: string): void {
    if (value === 'light' || value === 'dark') this.choose(value === this.themeStyle() ? 'map' : value);
  }

  protected onOpacity(percent: number): void {
    this.state.setOpacity(percent / 100);
  }

  private choose(background: Background): void {
    this.state.setBackground(background);
    this.changed.emit(background);
  }
}

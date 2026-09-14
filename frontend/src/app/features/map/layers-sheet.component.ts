import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { BACKGROUNDS, backgroundAvailable, type Background } from '../../map/background';
import { CheckRowComponent } from '../../ui/check-row/check-row.component';
import { RangeSliderComponent } from '../../ui/range-slider/range-slider.component';
import { type SegmentOption, SegmentedComponent } from '../../ui/segmented/segmented.component';

/** Ein Text je Hintergrund, in der Reihenfolge des Boards. */
const BACKGROUND_KEY: Record<Background, TranslationKey> = {
  map: 'map.basemap.map',
  light: 'map.basemap.light',
  topo: 'map.basemap.topo',
  satellite: 'map.basemap.satellite',
};

/** Was auf der Karte liegt: Hintergrund, eigene Objekte, Deckkraft. */
@Component({
  selector: 'app-layers-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckRowComponent, RangeSliderComponent, SegmentedComponent, TranslatePipe],
  templateUrl: './layers-sheet.component.html',
  styleUrl: './layers-sheet.component.scss',
})
export class LayersSheetComponent {
  private readonly i18n = inject(I18nService);

  readonly background = input.required<Background>();
  /** Deckkraft der Wertebene, 0 als kein Wert, 1 als volle Deckung. */
  readonly opacity = input.required<number>();
  /** Nur in der Darstellung Ebene lässt sich die Vorhersage darunter legen. */
  readonly showsLayer = input(false);
  readonly forecastBelow = input(false);
  readonly showMarkers = input(true);
  readonly showZones = input(true);
  readonly showSharedFinds = input(true);
  readonly markerCount = input(0);
  readonly zoneCount = input(0);
  readonly sharedFindCount = input(0);

  readonly backgroundChange = output<Background>();
  readonly opacityChange = output<number>();
  readonly forecastBelowChange = output<boolean>();
  readonly showMarkersChange = output<boolean>();
  readonly showZonesChange = output<boolean>();
  readonly showSharedFindsChange = output<boolean>();
  readonly closed = output();

  protected readonly choices = computed<SegmentOption[]>(() =>
    BACKGROUNDS.map((value) => ({ value, label: this.i18n.translate(BACKGROUND_KEY[value]) })),
  );

  protected readonly percent = computed(() => Math.round(this.opacity() * 100));

  protected chooseBackground(value: string): void {
    const chosen = BACKGROUNDS.find((entry) => entry === value);
    if (chosen && backgroundAvailable(chosen)) this.backgroundChange.emit(chosen);
  }

  protected onOpacity(percent: number): void {
    this.opacityChange.emit(percent / 100);
  }

  protected count(value: number): string {
    return new Intl.NumberFormat(this.i18n.locale()).format(value);
  }
}

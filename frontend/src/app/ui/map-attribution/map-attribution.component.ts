import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/** Die Marke unten links auf der Karte: „© OpenStreetMap“, mit Vermerk. */
@Component({
  selector: 'app-map-attribution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.inset-block-end]': 'insetBlockEnd()' },
  templateUrl: './map-attribution.component.html',
  styleUrl: './map-attribution.component.scss',
})
export class MapAttributionComponent {
  private readonly i18n = inject(I18nService);

  readonly note = input<string | null>(null);
  /** Der freie Streifen über dem Blatt, wenn eines die Karte unten deckt. */
  readonly above = input<string | null>(null);

  protected readonly text = computed(() => {
    const note = this.note();
    const osm = this.i18n.translate('map.attribution.osm');
    return note === null || note === '' ? osm : this.i18n.translate('map.attribution.layer', { osm, note });
  });

  protected readonly insetBlockEnd = computed(() => {
    const above = this.above();
    return above === null ? '8px' : `calc(${above} + 8px)`;
  });
}

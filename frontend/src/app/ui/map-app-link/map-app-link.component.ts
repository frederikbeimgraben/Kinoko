import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { MapAppService } from '../../core/maps/map-app.service';
import { geoUri, googleMapsUrl, osmUrl } from '../../core/maps/map-links';
import { ListRowComponent } from '../list-row/list-row.component';

/** Zeile „In Karten-App öffnen“ in einem Objektblatt. */
@Component({
  selector: 'app-map-app-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, TranslatePipe],
  templateUrl: './map-app-link.component.html',
  styleUrl: './map-app-link.component.scss',
})
export class MapAppLinkComponent {
  private readonly viewport = inject(ViewportService);
  private readonly mapApp = inject(MapAppService);

  readonly target = input.required<readonly [number, number]>();

  protected open(): void {
    if (!this.viewport.wide()) {
      window.location.href = geoUri(this.target());
      return;
    }
    const url = this.mapApp.choice() === 'google' ? googleMapsUrl(this.target()) : osmUrl(this.target());
    window.open(url, '_blank', 'noopener');
  }
}

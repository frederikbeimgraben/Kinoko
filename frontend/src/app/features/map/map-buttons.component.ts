import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FloatingButtonComponent } from '../../ui/floating-button/floating-button.component';

/** The floating buttons at the top right of the map: layers, location, add entry, compass. */
@Component({
  selector: 'app-map-buttons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FloatingButtonComponent, TranslatePipe],
  host: { '[style.--map-buttons-banner-offset.px]': 'bannerOffset()' },
  templateUrl: './map-buttons.component.html',
  styleUrl: './map-buttons.component.scss',
})
export class MapButtonsComponent {
  readonly layersOpen = input(false);
  readonly showsLocation = input(true);
  readonly locationAllowed = input(false);
  readonly showAdd = input(false);
  readonly turned = input(false);
  readonly needle = input(0);
  /** Added top offset when a banner is above the map. */
  readonly bannerOffset = input(0);

  readonly layersToggled = output();
  readonly located = output();
  readonly add = output();
  readonly northed = output();
}

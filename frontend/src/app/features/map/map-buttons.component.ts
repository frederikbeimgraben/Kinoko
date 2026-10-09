import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FloatingButtonComponent } from '../../ui/floating-button/floating-button.component';

/** The lower end of the location button on the phone: inset 16, one step of 60, button 48. */
const LOCATION_END = 16 + 60 + 48;
/** The add button: 56 high, 16 above the sheet, and 12 free below the location button. */
const ADD_ROOM = 56 + 16 + 12;

/** The add button fits only while it stays below the location button. Else the sheet would push it over it. */
export function addFits(paneHeight: number, sheetHeight: number): boolean {
  return paneHeight - sheetHeight - ADD_ROOM >= LOCATION_END;
}

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

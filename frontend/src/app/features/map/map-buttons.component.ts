import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FloatingButtonComponent } from '../../ui/floating-button/floating-button.component';

/** Die schwebenden Knöpfe oben rechts auf der Karte: Ebenen, Ortung, Kompass. */
@Component({
  selector: 'app-map-buttons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FloatingButtonComponent, TranslatePipe],
  templateUrl: './map-buttons.component.html',
  styleUrl: './map-buttons.component.scss',
})
export class MapButtonsComponent {
  readonly layersOpen = input(false);
  readonly showsLocation = input(true);
  readonly locationAllowed = input(false);
  /** Der Kompass steht nur über einer gedrehten oder geneigten Karte. */
  readonly turned = input(false);
  /** Der Winkel der Nadel in Grad. */
  readonly needle = input(0);

  readonly layersToggled = output();
  readonly located = output();
  readonly northed = output();
}

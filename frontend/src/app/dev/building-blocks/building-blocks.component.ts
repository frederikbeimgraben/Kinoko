import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { WORKSHOP_TEXTS } from '../../core/i18n/workshop-texts';
import { ControlsCardsComponent } from './cards/controls/controls-cards.component';
import { DataCardsComponent } from './cards/data/data-cards.component';
import { DisplayCardsComponent } from './cards/display/display-cards.component';
import { MapCardsComponent } from './cards/map/map-cards.component';
import { OverlaysCardsComponent } from './cards/overlays/overlays-cards.component';
import { PrimitivesCardsComponent } from './cards/primitives/primitives-cards.component';
import { RowsCardsComponent } from './cards/rows/rows-cards.component';
import { SpeciesPageCardsComponent } from './cards/species-page/species-page-cards.component';

const THEME_ATTRIBUTE = 'data-theme';
const DARK = 'dark';

/** The pixel-test page: one group component per card set, dark theme. */
@Component({
  selector: 'app-building-blocks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ControlsCardsComponent,
    DataCardsComponent,
    DisplayCardsComponent,
    MapCardsComponent,
    OverlaysCardsComponent,
    PrimitivesCardsComponent,
    RowsCardsComponent,
    SpeciesPageCardsComponent,
  ],
  templateUrl: './building-blocks.component.html',
  styleUrl: './building-blocks.component.scss',
})
export class BuildingBlocksComponent {
  constructor() {
    inject(I18nService).addFallback(inject(WORKSHOP_TEXTS));

    const root = document.documentElement;
    const before = root.getAttribute(THEME_ATTRIBUTE);
    root.setAttribute(THEME_ATTRIBUTE, DARK);
    inject(DestroyRef).onDestroy(() => {
      if (before === null) root.removeAttribute(THEME_ATTRIBUTE);
      else root.setAttribute(THEME_ATTRIBUTE, before);
    });
  }
}

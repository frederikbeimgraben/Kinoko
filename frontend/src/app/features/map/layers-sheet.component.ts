import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { PopoverComponent, type PopoverAnchor } from '../../ui/popover/popover.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SheetComponent } from '../../ui/sheet/sheet.component';
import { LayersBodyComponent } from './layers-body.component';

/**
 * What is on the map: ground, style, opacity and the own objects.
 * A sheet on the phone (board `MapLayers`), a popover left of the layers button on the desktop.
 */
@Component({
  selector: 'app-layers-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LayersBodyComponent,
    OverlayHostComponent,
    PopoverComponent,
    ScrollFadeDirective,
    SheetComponent,
    TranslatePipe,
  ],
  templateUrl: './layers-sheet.component.html',
  styleUrl: './layers-sheet.component.scss',
})
export class LayersSheetComponent {
  protected readonly wide = inject(ViewportService).wide;

  /** Board `MapDesktopLayers`: the card is 104 px from the right edge, at the top of the layers button. */
  protected readonly anchor: PopoverAnchor = { top: 40, end: 104 };

  readonly closed = output();
}

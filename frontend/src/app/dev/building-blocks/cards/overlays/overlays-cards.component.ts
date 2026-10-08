import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ConfirmDialogComponent } from '../../../../ui/confirm-dialog/confirm-dialog.component';
import { OverlayHeadComponent } from '../../../../ui/overlay-head/overlay-head.component';
import { OverlayHostComponent } from '../../../../ui/overlay-host/overlay-host.component';
import { PopoverComponent, type PopoverAnchor } from '../../../../ui/popover/popover.component';
import { PopoverItemComponent } from '../../../../ui/popover/popover-item.component';
import { SheetComponent } from '../../../../ui/sheet/sheet.component';
import { BlockCardComponent } from '../block-card/block-card.component';
import { WideViewportDirective } from './wide-viewport.directive';

/** The place of the card from `project/Popover.dc.html`. */
const ANCHOR: PopoverAnchor = { top: 16, end: 88 };

/** The cards of the sheets, modals and dialogs. */
@Component({
  selector: 'app-overlays-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlockCardComponent,
    ConfirmDialogComponent,
    OverlayHeadComponent,
    OverlayHostComponent,
    PopoverComponent,
    PopoverItemComponent,
    SheetComponent,
    TranslatePipe,
    WideViewportDirective,
  ],
  templateUrl: './overlays-cards.component.html',
  styleUrl: './overlays-cards.component.scss',
})
export class OverlaysCardsComponent {
  protected readonly anchor = ANCHOR;
}

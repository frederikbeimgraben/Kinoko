import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ConfirmDialogComponent } from '../../../../ui/confirm-dialog/confirm-dialog.component';
import { PopoverComponent, type PopoverAnchor } from '../../../../ui/popover/popover.component';
import { PopoverItemComponent } from '../../../../ui/popover/popover-item.component';
import { BlockCardComponent } from '../block-card/block-card.component';

/** Die Lage der Karte aus `project/Popover.dc.html`. */
const ANCHOR: PopoverAnchor = { top: 16, end: 88 };

/** Die Karten der Blätter, Modale und Dialoge. */
@Component({
  selector: 'app-overlays-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlockCardComponent,
    ConfirmDialogComponent,
    PopoverComponent,
    PopoverItemComponent,
    TranslatePipe,
  ],
  templateUrl: './overlays-cards.component.html',
  styleUrl: './overlays-cards.component.scss',
})
export class OverlaysCardsComponent {
  protected readonly anchor = ANCHOR;
}

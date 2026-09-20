import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { MapButtonsComponent } from '../../../../features/map/map-buttons.component';
import { ObjectTitleComponent } from '../../../../ui/object-title/object-title.component';
import { MapPinComponent } from '../../../../ui/map-pin/map-pin.component';
import { ReviewQueueComponent } from '../../../../ui/review-queue/review-queue.component';
import { StateViewComponent } from '../../../../ui/state-view/state-view.component';
import { StepBarComponent, type StepAction } from '../../../../ui/step-bar/step-bar.component';
import { ZoneShapeComponent } from '../../../../ui/zone-shape/zone-shape.component';
import { BlockCardComponent } from '../block-card/block-card.component';

/** Die Karten-Bausteine, je ihre Vorgabe aus dem Board. */
@Component({
  selector: 'app-map-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlockCardComponent,
    MapButtonsComponent,
    MapPinComponent,
    ObjectTitleComponent,
    ReviewQueueComponent,
    StateViewComponent,
    StepBarComponent,
    TranslatePipe,
    ZoneShapeComponent,
  ],
  templateUrl: './map-cards.component.html',
  styleUrl: './map-cards.component.scss',
})
export class MapCardsComponent {
  private readonly i18n = inject(I18nService);

  protected readonly stepBarActions: readonly StepAction[] = [
    {
      label: this.i18n.translate('common.undo'),
      icon: 'undo',
      variant: 'secondary',
      run: () => undefined,
    },
    {
      label: this.i18n.translate('common.cancel'),
      icon: 'close',
      variant: 'secondary',
      run: () => undefined,
    },
    {
      label: this.i18n.translate('beispiel.fertig'),
      icon: 'check',
      variant: 'primary',
      run: () => undefined,
    },
  ];

  protected readonly queueItems: readonly string[] = ['placeholder'];
}

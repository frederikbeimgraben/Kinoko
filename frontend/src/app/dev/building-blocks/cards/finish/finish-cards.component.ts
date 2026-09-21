import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProgressComponent } from '../../../../ui/progress/progress.component';
import { RangeSliderComponent } from '../../../../ui/range-slider/range-slider.component';
import { BlockCardComponent } from '../block-card/block-card.component';

/** The two D1 batch 10 cards pending on their 40px baseline mistake. */
@Component({
  selector: 'app-finish-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BlockCardComponent, ProgressComponent, RangeSliderComponent],
  templateUrl: './finish-cards.component.html',
})
export class FinishCardsComponent {}

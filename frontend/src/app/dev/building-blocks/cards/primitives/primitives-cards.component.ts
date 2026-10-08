import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormFieldComponent } from '../../../../ui/form-field/form-field.component';
import { LevelPillComponent } from '../../../../ui/level-pill/level-pill.component';
import { RowGroupComponent } from '../../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../../ui/section/section.component';
import { SegmentedComponent, type SegmentOption } from '../../../../ui/segmented/segmented.component';
import { SvgIconComponent } from '../../../../ui/svg-icon/svg-icon.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { BlockCardComponent } from '../block-card/block-card.component';

/** The options of the segment card, in the board order. */
const SEGMENT_KEYS = ['forecast', 'layer', 'combination'] as const;

/** The six small blocks of the D1 base kit, each with its reference design. */
@Component({
  selector: 'app-primitives-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlockCardComponent,
    FormFieldComponent,
    LevelPillComponent,
    RowGroupComponent,
    SectionComponent,
    SegmentedComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './primitives-cards.component.html',
})
export class PrimitivesCardsComponent {
  private readonly i18n = inject(I18nService);

  protected readonly segmentOptions: readonly SegmentOption[] = SEGMENT_KEYS.map((key) => ({
    value: key,
    label: this.i18n.translate(`map.tab.${key}`),
  }));
}

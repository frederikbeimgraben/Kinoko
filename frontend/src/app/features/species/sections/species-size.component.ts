import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  MeasurementGroupComponent,
  type MeasurementRow,
} from '../../../ui/measurement-group/measurement-group.component';
import type { MeasurementGroup, PartNote } from '../../../core/api/models';
import { PART_TEXT } from '../labels';

/** Eine Karte je Körperteil mit seinen Strecken und seiner Notiz. */
interface PartCard {
  part: string;
  rows: MeasurementRow[];
  description: string;
  comment: string;
}

/** Die Maße einer Art, je Körperteil eine Karte. */
@Component({
  selector: 'app-species-size',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MeasurementGroupComponent, TranslatePipe],
  templateUrl: './species-size.component.html',
  styleUrl: './species-size.component.scss',
})
export class SpeciesSizeComponent {
  private readonly i18n = inject(I18nService);

  readonly groups = input.required<readonly MeasurementGroup[]>();
  readonly notes = input<readonly PartNote[]>([]);

  protected readonly cards = computed<PartCard[]>(() =>
    this.groups().map((group) => {
      const note = this.notes().find((one) => one.part === group.part);
      return {
        part: this.i18n.translate(PART_TEXT[group.part]),
        description: note?.description ?? '',
        comment: note?.comment ?? '',
        rows: group.measurements.map((one) => ({
          extent: one.dimension,
          spans: [{ from: one.low, to: one.high }],
          unit: this.i18n.translate(`enum.unit.${one.unit}` as 'enum.unit.cm'),
        })),
      };
    }),
  );
}

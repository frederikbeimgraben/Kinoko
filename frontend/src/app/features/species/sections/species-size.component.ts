import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  MeasurementGroupComponent,
  type MeasurementRow,
} from '../../../ui/measurement-group/measurement-group.component';
import type { MeasurementGroup } from '../../../core/api/models';
import { PART_TEXT } from '../labels';

/** Eine Karte je Körperteil mit seinen Strecken. */
interface PartCard {
  part: string;
  rows: MeasurementRow[];
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

  protected readonly cards = computed<PartCard[]>(() =>
    this.groups().map((group) => ({
      part: this.i18n.translate(PART_TEXT[group.part]),
      rows: group.measurements.map((one) => ({
        extent: one.dimension,
        spans: rare(one),
        unit: this.i18n.translate(`enum.unit.${one.unit}` as 'enum.unit.cm'),
      })),
    })),
  );
}

/** Die übliche Spanne, dahinter die seltene, wenn eine steht. */
function rare(one: MeasurementGroup['measurements'][number]): MeasurementRow['spans'] {
  const spans: { from: number | null; to: number | null }[] = [{ from: one.low, to: one.high }];
  const low = one.rareLow ?? null;
  const high = one.rareHigh ?? null;
  if (low !== null || high !== null) spans.push({ from: low, to: high });
  return spans;
}

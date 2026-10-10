import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  MeasurementGroupComponent,
  type FactRow,
  type MeasurementRow,
} from '../../../ui/measurement-group/measurement-group.component';
import type { BodyPart, MeasurementGroup, PartNote, RingShape } from '../../../core/api/models';
import { PART_TEXT, RING_SHAPE_TEXT } from '../labels';

/** The body order of the parts. */
const PART_ORDER = Object.keys(PART_TEXT) as BodyPart[];

/** A card for one body part with its measurements and note. */
interface PartCard {
  part: string;
  rows: MeasurementRow[];
  facts: FactRow[];
  description: string;
  comment: string;
}

/** The size of a species, one card for each body part. The ring card also shows the ring shape,
 * so a ring with a shape and without a measure has a card too. */
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
  readonly ringShape = input<RingShape | null>(null);

  protected readonly cards = computed<PartCard[]>(() =>
    this.parts().map((group) => {
      const note = this.notes().find((one) => one.part === group.part);
      const shape = group.part === 'ring' ? this.ringShape() : null;
      return {
        part: this.i18n.translate(PART_TEXT[group.part]),
        facts:
          shape === null
            ? []
            : [
                {
                  label: this.i18n.translate('species.field.shape'),
                  value: this.i18n.translate(RING_SHAPE_TEXT[shape]),
                },
              ],
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

  /** The measured parts. A ring with a shape and without a measure goes at its place in the body order. */
  private parts(): readonly MeasurementGroup[] {
    const groups = this.groups();
    if (this.ringShape() === null || groups.some((group) => group.part === 'ring')) return groups;
    const ring = PART_ORDER.indexOf('ring');
    const at = groups.findIndex((group) => PART_ORDER.indexOf(group.part) > ring);
    const empty: MeasurementGroup = { part: 'ring', measurements: [] };
    return at < 0 ? [...groups, empty] : [...groups.slice(0, at), empty, ...groups.slice(at)];
  }
}

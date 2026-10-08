import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { CheckRowComponent } from '../../ui/check-row/check-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { EXPORT_PARTS, partsFor, type ExportFormat, type ExportPart } from './export-files';
import type { DataCounts } from './my-data.store';

const FORMATS: readonly ExportFormat[] = ['json', 'csv', 'gpx'];

const PART_LABEL: Readonly<Record<ExportPart, TranslationKey>> = {
  finds: 'account.export.part.finds',
  markers: 'account.export.part.markers',
  zones: 'account.export.part.zones',
  photos: 'account.export.part.images',
  combinations: 'account.export.part.combinations',
};

/** One check row of the body. */
interface PartRow {
  readonly part: ExportPart;
  readonly label: string;
  readonly count: number | undefined;
  readonly on: boolean;
  readonly locked: boolean;
}

/** The body of the export sheet, per `DataExportBody.dc.html` and `DataExportGpxBody.dc.html`. */
@Component({
  selector: 'app-data-export-body',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckRowComponent, RowGroupComponent, SegmentedComponent, TranslatePipe],
  templateUrl: './data-export-body.component.html',
  styleUrl: './data-export-body.component.scss',
})
export class DataExportBodyComponent {
  private readonly i18n = inject(I18nService);

  readonly format = input.required<ExportFormat>();
  readonly parts = input.required<ReadonlySet<ExportPart>>();
  /** `null` while the counts load: the rows then have no count. */
  readonly counts = input<DataCounts | null>(null);

  readonly formatChange = output<ExportFormat>();
  readonly partToggle = output<ExportPart>();

  protected readonly formats: readonly SegmentOption[] = FORMATS.map((value) => ({
    value,
    label: value.toUpperCase(),
  }));

  protected readonly rows = computed<readonly PartRow[]>(() => {
    const allowed = new Set(partsFor(this.format()));
    const counts = this.counts();
    return EXPORT_PARTS.map((part) => ({
      part,
      label: this.i18n.translate(PART_LABEL[part]),
      count: counts?.[part],
      on: allowed.has(part) && this.parts().has(part),
      locked: !allowed.has(part),
    }));
  });

  protected selectFormat(value: string): void {
    const format = FORMATS.find((candidate) => candidate === value);
    if (format) this.formatChange.emit(format);
  }
}

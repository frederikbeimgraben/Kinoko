import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  ColourFieldComponent,
  type ColourMode,
  type ColourValue,
} from '../../../ui/colour-field/colour-field.component';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import type { ColourGroup } from '../../../core/api/models';
import { PART_TEXT } from '../labels';

/** A colour row: the part, the names and the swatch. */
interface ColourRow {
  part: string;
  names: string;
  colours: readonly ColourValue[];
  mode: ColourMode;
}

/** The catalogue mode `distinct` means hard edges between colours. */
const MODE: Record<ColourGroup['mode'], ColourMode> = {
  single: 'single',
  gradient: 'gradient',
  distinct: 'multiple',
};

const SEPARATOR = ', ';

/** The colours of a species, one row for each body part. */
@Component({
  selector: 'app-species-colours',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourFieldComponent, ListRowComponent, RowGroupComponent, SectionComponent, TranslatePipe],
  templateUrl: './species-colours.component.html',
  styleUrl: './species-colours.component.scss',
})
export class SpeciesColoursComponent {
  private readonly i18n = inject(I18nService);

  readonly groups = input.required<readonly ColourGroup[]>();

  protected readonly rows = computed<ColourRow[]>(() =>
    this.groups().map((group) => ({
      part: this.i18n.translate(PART_TEXT[group.part]),
      names: this.names(group),
      colours: group.colours,
      mode: MODE[group.mode],
    })),
  );

  /** A gradient reads "from A to B". Other modes list the names side by side. */
  private names(group: ColourGroup): string {
    const words = group.colours.map((colour) => colour.name);
    if (group.mode !== 'gradient') return words.join(SEPARATOR);
    return words.join(` ${this.i18n.translate('common.to')} `);
  }
}

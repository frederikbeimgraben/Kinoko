import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  ColourFieldComponent,
  type ColourValue,
} from '../../../ui/colour-field/colour-field.component';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { SvgIconComponent } from '../../../ui/svg-icon/svg-icon.component';
import type { Lookalike } from '../../../core/api/models';

/** Eine Verwechslung in der Zeile: Farbe, Name und zwei Wege. */
interface LookalikeRow {
  slug: string;
  name: string;
  colours: readonly ColourValue[];
}

/** Die Verwechslungen einer Art. Ein Weg vergleicht, der andere öffnet die Art. */
@Component({
  selector: 'app-species-lookalikes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourFieldComponent, ListRowComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './species-lookalikes.component.html',
  styleUrl: './species-lookalikes.component.scss',
})
export class SpeciesLookalikesComponent {
  readonly lookalikes = input.required<readonly Lookalike[]>();

  readonly compared = output<string>();
  readonly opened = output<string>();

  protected readonly rows = computed<LookalikeRow[]>(() =>
    this.lookalikes().map((one) => ({ slug: one.slug, name: one.name, colours: one.capColours })),
  );
}

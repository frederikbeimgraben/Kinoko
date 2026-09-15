import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { PrivateImageComponent } from '../../../ui/private-image/private-image.component';
import { SvgIconComponent } from '../../../ui/svg-icon/svg-icon.component';
import { photoPath, type Lookalike } from '../../../core/api/models';
import { SpeciesState } from '../species.state';

/** Eine Verwechslung in der Zeile: Bild, Name und zwei Wege. */
interface LookalikeRow {
  slug: string;
  name: string;
  image: string | null;
}

/** Die Verwechslungen einer Art. Ein Weg vergleicht, der andere öffnet die Art. */
@Component({
  selector: 'app-species-lookalikes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, PrivateImageComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './species-lookalikes.component.html',
  styleUrl: './species-lookalikes.component.scss',
})
export class SpeciesLookalikesComponent {
  private readonly catalogue = inject(SpeciesState);

  readonly lookalikes = input.required<readonly Lookalike[]>();

  readonly compared = output<string>();
  readonly opened = output<string>();

  protected readonly rows = computed<LookalikeRow[]>(() =>
    this.lookalikes().map((one) => {
      const lead = this.catalogue.entryOf(one.slug)?.leadPhotoId ?? null;
      return { slug: one.slug, name: one.name, image: lead === null ? null : photoPath(lead, 'list') };
    }),
  );
}

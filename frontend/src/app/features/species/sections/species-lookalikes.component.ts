import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { IconButtonComponent } from '../../../ui/icon-button/icon-button.component';
import { PrivateImageComponent } from '../../../ui/private-image/private-image.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { SvgIconComponent } from '../../../ui/svg-icon/svg-icon.component';
import { photoPath, type Lookalike } from '../../../core/api/models';
import { SpeciesStore } from '../species.store';

const FALLBACK_COLOUR = '#7a5230';

/** A lookalike in its row: photo or fallback colour, name and the sentence that tells the difference. */
interface LookalikeRow {
  slug: string;
  name: string;
  note: string;
  colour: string;
  image: string | null;
}

/** The lookalikes of a species. One action compares, the other opens the species. */
@Component({
  selector: 'app-species-lookalikes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ListRowComponent,
    IconButtonComponent,
    PrivateImageComponent,
    RowGroupComponent,
    SectionComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './species-lookalikes.component.html',
  styleUrl: './species-lookalikes.component.scss',
})
export class SpeciesLookalikesComponent {
  private readonly catalogue = inject(SpeciesStore);

  readonly lookalikes = input.required<readonly Lookalike[]>();
  /** The section title. Empty gives the title of the species page. */
  readonly label = input('');

  readonly compared = output<string>();
  readonly opened = output<string>();

  protected readonly rows = computed<LookalikeRow[]>(() =>
    this.lookalikes().map((one) => {
      const lead = this.catalogue.entryOf(one.slug)?.leadPhotoId ?? null;
      return {
        slug: one.slug,
        name: one.name,
        note: one.difference ?? '',
        colour: one.capColours[0]?.hex ?? FALLBACK_COLOUR,
        image: lead === null ? null : photoPath(lead, 'list'),
      };
    }),
  );
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { OverlayHostComponent } from '../../../ui/overlay-host/overlay-host.component';
import { SearchFieldComponent } from '../../../ui/search-field/search-field.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { SheetComponent } from '../../../ui/sheet/sheet.component';
import { SpeciesRowComponent } from '../../../ui/species-row/species-row.component';
import { matches, speciesRow } from '../rows';
import { SpeciesLookalikesComponent } from '../sections/species-lookalikes.component';
import { SpeciesStore } from '../species.store';

/** The most hits that the search shows. More text makes the list shorter. */
const MAX_HITS = 30;

/** The way into the comparison per `CompareEntryBody.dc.html`: a species search, and the lookalikes below. */
@Component({
  selector: 'app-compare-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    OverlayHostComponent,
    SearchFieldComponent,
    SectionComponent,
    SheetComponent,
    SpeciesLookalikesComponent,
    SpeciesRowComponent,
    TranslatePipe,
  ],
  templateUrl: './compare-entry.component.html',
  styleUrl: './compare-entry.component.scss',
})
export class CompareEntryComponent {
  private readonly catalogue = inject(SpeciesStore);
  private readonly i18n = inject(I18nService);

  /** The species that the comparison starts from. */
  readonly slug = input.required<string>();
  readonly open = input(false);

  /** The second species of the comparison. */
  readonly picked = output<string>();
  /** The species page of a lookalike. */
  readonly opened = output<string>();
  readonly closed = output();

  protected readonly query = signal('');

  protected readonly lookalikes = computed(() => this.catalogue.entryOf(this.slug())?.lookalikes ?? []);

  protected readonly hits = computed(() => {
    const text = this.query();
    if (text.trim() === '') return [];
    return this.catalogue
      .species()
      .filter((one) => one.slug !== this.slug() && matches(one, text))
      .slice(0, MAX_HITS)
      .map((one) => ({ slug: one.slug, row: speciesRow(one, this.i18n) }));
  });

  constructor() {
    // Each new opening starts with the lookalikes, not with the last search.
    effect(() => {
      if (!this.open()) this.query.set('');
    });
  }
}

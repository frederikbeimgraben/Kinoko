import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PopoverComponent, type PopoverAnchor } from '../../ui/popover/popover.component';
import { PopoverItemComponent } from '../../ui/popover/popover-item.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { SPECIES_SORTS, SpeciesFilterStore, type SpeciesSort } from './filter.store';

/** The text of each sort, in the order of the popover. */
export const SORT_TEXT: Readonly<Record<SpeciesSort, TranslationKey>> = {
  name: 'species.sort.name',
  latin: 'species.sort.latinName',
  edibility: 'species.sort.edibility',
  season: 'species.sort.season',
};

/** The corners of the two popovers, per `SpeciesSort.dc.html` and `SpeciesDesktopSort.dc.html`. */
const ANCHORS = {
  phone: { sort: { top: 60, end: 56 }, menu: { top: 60, end: 8 } },
  desk: { sort: { top: 64, end: 60 }, menu: { top: 64, end: 12 } },
} as const satisfies Record<string, Record<'sort' | 'menu', PopoverAnchor>>;

/** The search bar of the species list with the sort and the menu buttons, per `SearchBar.dc.html`. */
@Component({
  selector: 'app-species-search-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconButtonComponent,
    PageHeaderComponent,
    PopoverComponent,
    PopoverItemComponent,
    SearchFieldComponent,
    TranslatePipe,
  ],
  templateUrl: './species-search-bar.component.html',
  styleUrl: './species-search-bar.component.scss',
})
export class SpeciesSearchBarComponent {
  protected readonly filter = inject(SpeciesFilterStore);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  /** In the desktop pane the field has no area of its own. */
  readonly plain = input(false);

  protected readonly open = signal<'sort' | 'menu' | null>(null);

  protected readonly anchors = computed(() => (this.plain() ? ANCHORS.desk : ANCHORS.phone));

  protected readonly sorts = computed(() =>
    SPECIES_SORTS.map((key) => ({
      key,
      label: this.i18n.translate(SORT_TEXT[key]),
      on: key === this.filter.sort(),
    })),
  );

  protected setSort(sort: SpeciesSort): void {
    this.filter.setSort(sort);
    this.open.set(null);
  }

  protected toGlossary(): void {
    this.open.set(null);
    void this.router.navigateByUrl('/konto/glossar');
  }
}

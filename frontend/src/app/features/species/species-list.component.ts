import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ViewportService } from '../../core/layout/viewport.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { SpeciesFilterChipsComponent } from './filter-chips.component';
import { SpeciesFilterSheetComponent } from './filter-sheet.component';
import { SpeciesFilterStore } from './filter.store';
import { SpeciesDeskComponent } from './species-desk.component';
import { SpeciesListingStore } from './species-listing.store';
import { SpeciesResultsComponent } from './species-results.component';
import { SpeciesSearchBarComponent } from './species-search-bar.component';
import { SpeciesStore } from './species.store';

/** The species tab: search, filter and the list from the catalogue on the device. */
@Component({
  selector: 'app-species-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SpeciesDeskComponent,
    SpeciesFilterChipsComponent,
    SpeciesFilterSheetComponent,
    SpeciesResultsComponent,
    SpeciesSearchBarComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './species-list.component.html',
  styleUrl: './species-list.component.scss',
})
export class SpeciesListComponent {
  protected readonly catalogue = inject(SpeciesStore);
  protected readonly listing = inject(SpeciesListingStore);
  protected readonly filter = inject(SpeciesFilterStore);
  private readonly router = inject(Router);

  protected readonly wide = inject(ViewportService).wide;

  constructor() {
    void this.catalogue.loadBundle();
  }

  protected open(slug: string): void {
    this.catalogue.select(slug);
    void this.router.navigate(['/arten', slug]);
  }
}

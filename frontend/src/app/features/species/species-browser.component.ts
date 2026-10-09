import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SplitLayoutComponent } from '../../ui/split-layout/split-layout.component';
import { SurfaceComponent } from '../../ui/surface/surface.component';
import { SpeciesFilterPanelComponent } from './filter-panel.component';
import { SpeciesFilterStore } from './filter.store';
import { SpeciesListingStore } from './species-listing.store';
import { SpeciesResultsComponent } from './species-results.component';
import { SpeciesSearchBarComponent } from './species-search-bar.component';
import { SpeciesStore } from './species.store';

/** The desktop list pane: the plain search bar, the filter column and the list, per `SpeciesDesktop.dc.html`. */
@Component({
  selector: 'app-species-browser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ScrollFadeDirective,
    SpeciesFilterPanelComponent,
    SpeciesResultsComponent,
    SpeciesSearchBarComponent,
    SplitLayoutComponent,
    SurfaceComponent,
  ],
  templateUrl: './species-browser.component.html',
  styleUrl: './species-browser.component.scss',
})
export class SpeciesBrowserComponent {
  protected readonly catalogue = inject(SpeciesStore);
  protected readonly listing = inject(SpeciesListingStore);
  protected readonly filter = inject(SpeciesFilterStore);
  private readonly router = inject(Router);

  /** The slug of the species in the detail pane. Its row is selected. */
  readonly active = input<string | null>(null);

  constructor() {
    void this.catalogue.loadBundle();
    effect(() => {
      const slug = this.active();
      if (slug !== null) this.listing.reveal(slug);
    });
  }

  protected open(slug: string): void {
    this.catalogue.select(slug);
    void this.router.navigate(['/arten', slug]);
  }
}

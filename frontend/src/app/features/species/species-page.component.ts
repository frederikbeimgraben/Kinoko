import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { SpeciesImagesComponent } from '../images/species-images.component';
import { SpeciesColourChangeComponent } from './sections/species-colour-change.component';
import { SpeciesColoursComponent } from './sections/species-colours.component';
import { SpeciesFeaturesComponent } from './sections/species-features.component';
import { SpeciesHymeniumComponent } from './sections/species-hymenium.component';
import { SpeciesLookalikesComponent } from './sections/species-lookalikes.component';
import { SpeciesSensesComponent } from './sections/species-senses.component';
import { SpeciesSizeComponent } from './sections/species-size.component';
import { SpeciesTaxonomyComponent } from './sections/species-taxonomy.component';
import { SpeciesTimeComponent } from './sections/species-time.component';
import { SpeciesState } from './species.state';

/** Die Artseite: Kopf, die Abschnitte des Katalogs und der Weg zur Karte. */
@Component({
  selector: 'app-species-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    SpeciesColourChangeComponent,
    SpeciesColoursComponent,
    SpeciesFeaturesComponent,
    SpeciesHymeniumComponent,
    SpeciesImagesComponent,
    SpeciesLookalikesComponent,
    SpeciesSensesComponent,
    SpeciesSizeComponent,
    SpeciesTaxonomyComponent,
    SpeciesTimeComponent,
    TranslatePipe,
  ],
  templateUrl: './species-page.component.html',
  styleUrl: './species-page.component.scss',
})
export class SpeciesPageComponent {
  private readonly state = inject(SpeciesState);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly viewport = inject(ViewportService);

  readonly slug = input.required<string>();

  protected readonly wide = this.viewport.wide;
  protected readonly species = computed(() => this.state.entryOf(this.slug()));
  protected readonly waiting = computed(() => this.state.loading());
  protected readonly title = computed(() => this.species()?.name ?? '');

  constructor() {
    void this.state.loadBundle();
  }

  protected back(): void {
    this.location.back();
  }

  protected toList(): void {
    void this.router.navigateByUrl('/arten');
  }

  protected toMap(): void {
    this.state.select(this.slug());
    void this.router.navigateByUrl('/karte');
  }

  protected open(slug: string): void {
    void this.router.navigate(['/arten', slug]);
  }

  protected compare(slug: string): void {
    void this.router.navigate(['/arten', this.slug(), 'vergleich', slug]);
  }
}
